// controllers/inventoryController.js
// The Inventory surface over the existing Item collection. Inventory is deliberately NOT a
// separate catalogue: an inventory row IS an Item of type "product", so
// stock levels can never drift out of sync with the product they belong to.
//
// Every stock change writes two things inside one transaction — the StockMovement ledger row
// (source of truth) and the item's denormalized `inventory.currentStock` (what the list reads).
// Mirrors the session/transaction pattern the accounting controllers already use.
const mongoose = require("mongoose");
const Item = require("../models/Item");
const StockMovement = require("../models/StockMovement");

// Shared shape for "which items count as inventory" — every read below starts from this so the
// list, the KPIs, and the select-all id list can never disagree about what's on the page.
//
// Every PRODUCT is inventory, automatically: a product added in Products & Services shows up here
// straight away with a quantity of 0 until stock is recorded against it. There is no opt-in flag
// to forget to tick. Services are excluded because they have no stock to count.
//
// Items created before the inventory fields existed have no `inventory` sub-document at all, so
// every read below has to treat a missing currentStock as 0 rather than assuming the field is
// there — hence the $ifNull wrappers throughout.
function baseInventoryQuery(organization) {
  return { organization, type: "product" };
}

// currentStock / lowStockThreshold as safe numbers, for use inside aggregation and $expr.
const STOCK = { $ifNull: ["$inventory.currentStock", 0] };
const THRESHOLD = { $ifNull: ["$inventory.lowStockThreshold", 0] };

// Sort keys the client may pass, mapped to real document paths. An allow-list rather than a
// pass-through so a caller can't sort by an arbitrary (or non-indexed) field.
const SORTABLE = {
  name: "name",
  category: "category",
  currentStock: "inventory.currentStock",
  purchasePrice: "purchasePrice",
  sellingPrice: "sellingPrice",
  lastUpdated: "inventory.lastMovementAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

/**
 * GET /api/inventory
 * Paginated stock-tracked items + org-wide KPI summary.
 *
 * Query: page, limit, search, category, stockStatus(in|low|out), sortBy, sortOrder, allIds
 *
 * The `summary` is computed by aggregation across EVERY matching item, not just the returned
 * page — the KPI cards must describe the whole filtered set, the same reasoning as the payments
 * timeline's server-computed summary.
 */
const getInventory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const { search, category, stockStatus, sortBy = "name", sortOrder = "asc" } = req.query;

    const query = baseInventoryQuery(req.user.organization);

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { hsnSac: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    // All three are field-to-field comparisons against a possibly-missing sub-document, so they
    // go through $expr with $ifNull rather than a plain find() filter — a product that has never
    // had stock recorded must still count as "out of stock", not vanish from the results.
    if (stockStatus === "out") {
      query.$expr = { $lte: [STOCK, 0] };
    } else if (stockStatus === "low") {
      query.$expr = { $and: [{ $gt: [STOCK, 0] }, { $lte: [STOCK, THRESHOLD] }] };
    } else if (stockStatus === "in") {
      query.$expr = { $gt: [STOCK, THRESHOLD] };
    }

    // Select-all-across-pages, same contract as itemController's paginated list.
    if (req.query.allIds === "true") {
      const all = await Item.find(query).select("_id").lean();
      return res.json({ ids: all.map((i) => i._id) });
    }

    const sortObj = { [SORTABLE[sortBy] || "name"]: sortOrder === "desc" ? -1 : 1 };

    const [items, totalCount, summaryRows] = await Promise.all([
      Item.find(query).sort(sortObj).skip(skip).limit(limit).select("-__v").lean(),
      Item.countDocuments(query),
      Item.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            // Stock value is intentionally floored at 0 per item: a negative stock level is a
            // data problem, not negative money, and letting it subtract would quietly understate
            // the total.
            stockValueSales: {
              $sum: { $multiply: [{ $max: [STOCK, 0] }, { $ifNull: ["$sellingPrice", 0] }] },
            },
            stockValuePurchase: {
              $sum: { $multiply: [{ $max: [STOCK, 0] }, { $ifNull: ["$purchasePrice", 0] }] },
            },
            positiveStockItems: { $sum: { $cond: [{ $gt: [STOCK, 0] }, 1, 0] } },
            positiveStockQty: { $sum: { $cond: [{ $gt: [STOCK, 0] }, STOCK, 0] } },
            lowStockItems: { $sum: { $cond: [{ $lte: [STOCK, THRESHOLD] }, 1, 0] } },
            lowStockQty: { $sum: { $cond: [{ $lte: [STOCK, THRESHOLD] }, STOCK, 0] } },
            totalItems: { $sum: 1 },
          },
        },
      ]),
    ]);

    const agg = summaryRows[0] || {};
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      items,
      summary: {
        totalItems: agg.totalItems || 0,
        lowStockItems: agg.lowStockItems || 0,
        lowStockQty: agg.lowStockQty || 0,
        positiveStockItems: agg.positiveStockItems || 0,
        positiveStockQty: agg.positiveStockQty || 0,
        stockValueSales: agg.stockValueSales || 0,
        stockValuePurchase: agg.stockValuePurchase || 0,
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("inventoryController.getInventory error:", err);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
};

/**
 * Shared engine for stock-in and stock-out. Writes the ledger row and the item's running total
 * in ONE transaction, so a crash can never leave a movement recorded without the stock moving
 * (or vice versa).
 *
 * `direction` is "in" or "out"; the caller has already decided which. Stock is allowed to go
 * negative on an over-issue only when the caller explicitly passes allowNegative — otherwise an
 * out-movement larger than the stock on hand is rejected rather than silently creating a
 * negative balance.
 */
async function applyStockMovement(req, res, direction) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { quantity, reason, notes, referenceNumber, unitPrice, allowNegative } = req.body || {};

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Quantity must be a number greater than zero" });
    }

    const item = await Item.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!item) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Item not found" });
    }

    // Every product is stock-tracked, so there's no opt-in check here. Items created before the
    // inventory fields existed have no sub-document yet — create it on first movement rather
    // than rejecting the request.
    if (!item.inventory) item.inventory = {};

    const previousStock = Number(item.inventory.currentStock) || 0;
    const newStock = direction === "in" ? previousStock + qty : previousStock - qty;

    if (direction === "out" && newStock < 0 && !allowNegative) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: `Only ${previousStock} in stock — cannot remove ${qty}.`,
        code: "INSUFFICIENT_STOCK",
        available: previousStock,
      });
    }

    // Fall back to the item's own price so a movement always carries the value it was made at,
    // even when the caller doesn't supply one.
    const resolvedUnitPrice = Number.isFinite(Number(unitPrice))
      ? Number(unitPrice)
      : direction === "in"
        ? Number(item.purchasePrice) || 0
        : Number(item.sellingPrice) || 0;

    const [movement] = await StockMovement.create(
      [
        {
          organization: req.user.organization,
          item: item._id,
          direction,
          quantity: qty,
          previousStock,
          newStock,
          reason: reason || (direction === "in" ? "purchase" : "sale"),
          notes: notes || "",
          referenceNumber: referenceNumber || "",
          unitPrice: resolvedUnitPrice,
          user: req.user._id,
        },
      ],
      { session }
    );

    item.inventory.currentStock = newStock;
    item.inventory.lastMovementAt = new Date();
    await item.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ item, movement });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error(`inventoryController.stock${direction} error:`, err);
    res.status(500).json({ error: `Failed to record stock ${direction}` });
  }
}

/** POST /api/inventory/:id/stock-in */
const stockIn = (req, res) => applyStockMovement(req, res, "in");

/** POST /api/inventory/:id/stock-out */
const stockOut = (req, res) => applyStockMovement(req, res, "out");

/**
 * GET /api/inventory/:id/movements — paginated ledger for one item, newest first.
 */
const getMovements = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const query = { organization: req.user.organization, item: req.params.id };

    const [movements, totalCount] = await Promise.all([
      StockMovement.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email")
        .lean(),
      StockMovement.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    res.json({
      movements,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("inventoryController.getMovements error:", err);
    res.status(500).json({ error: "Failed to fetch stock movements" });
  }
};

/**
 * PATCH /api/inventory/:id/settings
 * Body: { lowStockThreshold? }
 *
 * Only the low-stock alert level is settable here. The stock quantity itself is never assigned
 * directly — it moves exclusively through stock-in/stock-out so the StockMovement ledger stays a
 * complete record of how the item reached its current level.
 */
const updateInventorySettings = async (req, res) => {
  try {
    const { lowStockThreshold } = req.body || {};

    if (lowStockThreshold === undefined || !Number.isFinite(Number(lowStockThreshold))) {
      return res.status(400).json({ error: "lowStockThreshold must be a number" });
    }

    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { $set: { "inventory.lowStockThreshold": Math.max(0, Number(lowStockThreshold)) } },
      { new: true }
    );

    if (!item) return res.status(404).json({ error: "Item not found" });

    res.json({ item });
  } catch (err) {
    console.error("inventoryController.updateInventorySettings error:", err);
    res.status(500).json({ error: "Failed to update inventory settings" });
  }
};

module.exports = {
  getInventory,
  stockIn,
  stockOut,
  getMovements,
  updateInventorySettings,
};
