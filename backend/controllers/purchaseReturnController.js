const PurchaseReturn = require("../models/PurchaseReturn");
const Vendor = require("../models/Vendor");
const Purchase = require("../models/Purchase");
const { syncDocumentStock } = require("../utils/inventorySync");

// Same math as purchaseController.js — kept in lockstep on purpose so the
// two document types never silently disagree on how a total is computed.
const calculateItemTotal = (quantity, unitPrice) => parseFloat(quantity) * parseFloat(unitPrice);

const calculateSubtotal = (items) =>
  items.reduce((sum, item) => sum + calculateItemTotal(item.quantity, item.unitPrice), 0);

const calculateTax = (subtotal, gstRate, transactionType) => {
  if (parseFloat(gstRate) <= 0) return 0;
  if (transactionType === "intra") {
    const halfRate = parseFloat(gstRate) / 2;
    return subtotal * (halfRate / 100) + subtotal * (halfRate / 100);
  }
  return subtotal * (parseFloat(gstRate) / 100);
};

// Count-based, "PR-00001" — mirrors Purchase's own generatePurchaseNumber
// exactly (not the Counter-based resolveDocumentNumber the Invoice family
// uses; see documentNumbering.js's own comments for why Purchase never
// adopted that scheme).
async function generateReturnNumber(organizationId) {
  const count = await PurchaseReturn.countDocuments({ organization: organizationId });
  return `PR-${(count + 1).toString().padStart(5, "0")}`;
}

const POPULATE = [
  { path: "vendor", select: "name email phone" },
  { path: "purchase", select: "purchaseNumber vendor" },
  { path: "items.itemId", select: "name description purchasePrice hsnSac gstRate" },
];

// Applies the inventory stock-out for a PurchaseReturn transitioning into
// "Paid" — the single inventory-triggering event for this module, mirroring
// purchaseOrderController.js's syncPurchaseOrderDeliveryStock (Delivered)
// exactly. "Paid" is terminal here (enforced by the callers below refusing to
// change status away from it), so there's no "moving out of Paid" branch to
// reverse — the only way to undo the stock-out is deleting the return, which
// deletePurchaseReturn reverses via isReversal: true.
//
// Goods physically leaving toward the vendor is a reduction in our own
// stock, same directional sense as a sale — hence baseDirection: "out".
async function syncPurchaseReturnStock(purchaseReturn, oldStatus, oldStockMovementStatus, userId) {
  const isNowPaid = purchaseReturn.status === "Paid";
  const wasPaid = oldStatus === "Paid";

  if (isNowPaid && !wasPaid && oldStockMovementStatus !== "applied") {
    await syncDocumentStock({
      organization: purchaseReturn.organization,
      documentId: purchaseReturn._id,
      documentModel: "PurchaseReturn",
      documentNumber: purchaseReturn.returnNumber,
      items: purchaseReturn.items,
      previousItems: [],
      baseDirection: "out",
      userId,
      reason: "return",
      isReversal: false,
    });
    purchaseReturn.stockMovementStatus = "applied";
    await purchaseReturn.save({ validateModifiedOnly: true });
  }
}

exports.createPurchaseReturn = async (req, res) => {
  try {
    const { vendor, purchase, items, notes, status, transactionType, gstRate, mode, reason, returnDate } = req.body;

    const vendorExists = await Vendor.findOne({ _id: vendor, organization: req.user.organization });
    if (!vendorExists) return res.status(404).json({ message: "Vendor not found" });

    if (purchase) {
      const purchaseExists = await Purchase.findOne({ _id: purchase, organization: req.user.organization });
      if (!purchaseExists) return res.status(404).json({ message: "Purchase not found" });
      if (String(purchaseExists.vendor) !== String(vendor)) {
        return res.status(400).json({ message: "That Purchase does not belong to the selected vendor" });
      }
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    const subtotal = calculateSubtotal(items);
    const calculatedTransactionType = transactionType || "intra";
    const calculatedGstRate = parseFloat(gstRate) || 0;
    const totalTax = calculateTax(subtotal, calculatedGstRate, calculatedTransactionType);
    const grandTotal = subtotal + totalTax;

    const returnNumber = await generateReturnNumber(req.user.organization);

    const purchaseReturn = new PurchaseReturn({
      vendor,
      purchase: purchase || null,
      returnNumber,
      returnDate: returnDate || Date.now(),
      items: items.map((item) => ({
        ...item,
        total: calculateItemTotal(item.quantity, item.unitPrice),
      })),
      subtotal,
      transactionType: calculatedTransactionType,
      gstRate: calculatedGstRate,
      totalTax,
      grandTotal,
      status: status || "Draft",
      mode: mode || "",
      reason: reason || "",
      notes: notes || "",
      user: req.user.id,
      organization: req.user.organization,
    });

    await purchaseReturn.save();

    // Covers creating a return directly with status "Paid" (e.g. recording
    // an already-settled historical return) — oldStatus is null (never was
    // Paid) so this applies exactly once, same guard as the update paths.
    await syncPurchaseReturnStock(purchaseReturn, null, purchaseReturn.stockMovementStatus, req.user.id);

    await purchaseReturn.populate(POPULATE);

    res.status(201).json(purchaseReturn);
  } catch (err) {
    console.error("Create purchase return error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllPurchaseReturns = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }

    const purchaseReturns = await PurchaseReturn.find(query).populate(POPULATE).sort({ createdAt: -1 });
    res.json(purchaseReturns);
  } catch (err) {
    console.error("Error fetching purchase returns:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllPurchaseReturnsWithPagination = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const { search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    let query = { organization: req.user.organization };
    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;

    const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    if (req.query.allIds === "true") {
      const all = await PurchaseReturn.find(query).select("_id").lean();
      return res.json({ ids: all.map((p) => p._id) });
    }

    const [purchaseReturns, totalCount] = await Promise.all([
      PurchaseReturn.find(query)
        .populate(POPULATE)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      PurchaseReturn.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      purchaseReturns,
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
    console.error("Error fetching purchase returns:", err);
    res.status(500).json({ error: "Failed to fetch purchase returns", message: err.message });
  }
};

exports.getPurchaseReturnsByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findOne({ _id: vendorId, organization: req.user.organization });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    const purchaseReturns = await PurchaseReturn.find({
      vendor: vendorId,
      organization: req.user.organization,
    })
      .populate(POPULATE)
      .sort({ createdAt: -1 });
    res.json(purchaseReturns);
  } catch (err) {
    console.error("Error fetching vendor purchase returns:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getPurchaseReturnById = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate(POPULATE);
    if (!purchaseReturn) return res.status(404).json({ message: "Purchase return not found" });
    res.json(purchaseReturn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!purchaseReturn) return res.status(404).json({ message: "Purchase return not found" });

    const { vendor, purchase, items, notes, status, transactionType, gstRate, mode, reason, returnDate } = req.body;

    // Captured before any field changes below, so the Paid stock sync (after
    // save) can tell what actually transitioned.
    const oldStatus = purchaseReturn.status;
    const oldStockMovementStatus = purchaseReturn.stockMovementStatus;

    // Paid is terminal — same rule as updatePurchaseReturnStatus, applied
    // here too since this endpoint is also how the edit form changes status.
    if (oldStatus === "Paid" && status !== undefined && status !== "Paid") {
      return res.status(400).json({ message: "A Paid Purchase Return can't be changed to another status." });
    }

    if (vendor !== undefined) purchaseReturn.vendor = vendor;
    if (purchase !== undefined) purchaseReturn.purchase = purchase || null;
    if (returnDate !== undefined) purchaseReturn.returnDate = returnDate;
    if (notes !== undefined) purchaseReturn.notes = notes;
    if (status !== undefined) purchaseReturn.status = status;
    if (mode !== undefined) purchaseReturn.mode = mode;
    if (reason !== undefined) purchaseReturn.reason = reason;

    if (items !== undefined) {
      if (!items.length) {
        return res.status(400).json({ message: "At least one item is required" });
      }
      const transactionTypeToUse = transactionType || purchaseReturn.transactionType;
      const gstRateToUse = gstRate !== undefined ? parseFloat(gstRate) || 0 : purchaseReturn.gstRate;
      const subtotal = calculateSubtotal(items);
      const totalTax = calculateTax(subtotal, gstRateToUse, transactionTypeToUse);

      purchaseReturn.items = items.map((item) => ({
        ...item,
        total: calculateItemTotal(item.quantity, item.unitPrice),
      }));
      purchaseReturn.subtotal = subtotal;
      purchaseReturn.transactionType = transactionTypeToUse;
      purchaseReturn.gstRate = gstRateToUse;
      purchaseReturn.totalTax = totalTax;
      purchaseReturn.grandTotal = subtotal + totalTax;
    }

    await purchaseReturn.save();

    // Applies the Paid stock-out. Covers both the edit form (which sends
    // items+status together) and any bulk status update that PUTs here
    // rather than the /status endpoint below.
    await syncPurchaseReturnStock(purchaseReturn, oldStatus, oldStockMovementStatus, req.user.id);

    await purchaseReturn.populate(POPULATE);

    res.json(purchaseReturn);
  } catch (err) {
    console.error("Update purchase return error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.updatePurchaseReturnStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Draft", "Pending", "Paid", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!purchaseReturn) return res.status(404).json({ message: "Purchase return not found" });

    const oldStatus = purchaseReturn.status;
    const oldStockMovementStatus = purchaseReturn.stockMovementStatus;

    // Paid is terminal — goods have already left toward the vendor and stock
    // moved accordingly, so it can't be walked back through the status
    // dropdown. (Not enforced via the enum itself since Paid is still a
    // perfectly valid status to reach.)
    if (oldStatus === "Paid" && status !== "Paid") {
      return res.status(400).json({ message: "A Paid Purchase Return can't be changed to another status." });
    }

    purchaseReturn.status = status;
    await purchaseReturn.save();

    await syncPurchaseReturnStock(purchaseReturn, oldStatus, oldStockMovementStatus, req.user.id);

    await purchaseReturn.populate(POPULATE);
    res.json(purchaseReturn);
  } catch (err) {
    console.error("Update purchase return status error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.deletePurchaseReturn = async (req, res) => {
  try {
    const purchaseReturn = await PurchaseReturn.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!purchaseReturn) return res.status(404).json({ message: "Purchase return not found" });

    // Deleting a Paid return must reverse its stock-out — otherwise stock
    // stays understated with no surviving document to explain why.
    if (purchaseReturn.stockMovementStatus === "applied") {
      await syncDocumentStock({
        organization: purchaseReturn.organization,
        documentId: purchaseReturn._id,
        documentModel: "PurchaseReturn",
        documentNumber: purchaseReturn.returnNumber,
        items: purchaseReturn.items,
        previousItems: [],
        baseDirection: "out",
        userId: req.user.id,
        reason: "adjustment",
        isReversal: true,
      });
    }

    await purchaseReturn.deleteOne();
    res.json({ message: "Purchase return deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk import — groups CSV rows by returnNumber::vendorName (case-insensitive)
// into one PurchaseReturn per group with multiple line items, exactly
// mirroring purchaseController.bulkImportPurchases's grouping strategy.
exports.bulkImportPurchaseReturns = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows to import" });
    }

    const groups = new Map();
    for (const row of rows) {
      const vendorName = (row.vendorName || "").trim();
      const itemName = (row.itemName || "").trim();
      if (!vendorName || !itemName) continue;

      const groupKey = `${(row.returnNumber || "").trim().toLowerCase()}::${vendorName.toLowerCase()}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          returnNumber: (row.returnNumber || "").trim(),
          vendorName,
          status: row.status || "Draft",
          mode: row.mode || "",
          reason: row.reason || "",
          notes: row.notes || "",
          items: [],
        });
      }
      groups.get(groupKey).items.push({
        name: itemName,
        quantity: parseFloat(row.quantity) || 1,
        unitPrice: parseFloat(row.unitPrice) || 0,
      });
    }

    let imported = 0;
    const errors = [];

    for (const group of groups.values()) {
      try {
        let vendor = await Vendor.findOne({
          name: { $regex: `^${group.vendorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
          organization: req.user.organization,
        });
        if (!vendor) {
          vendor = await Vendor.create({
            name: group.vendorName,
            organization: req.user.organization,
            user: req.user.id,
          });
        }

        const subtotal = calculateSubtotal(group.items);
        const returnNumber = group.returnNumber || (await generateReturnNumber(req.user.organization));

        await PurchaseReturn.create({
          vendor: vendor._id,
          returnNumber,
          items: group.items.map((item) => ({ ...item, total: calculateItemTotal(item.quantity, item.unitPrice) })),
          subtotal,
          totalTax: 0,
          grandTotal: subtotal,
          status: group.status,
          mode: group.mode,
          reason: group.reason,
          notes: group.notes,
          user: req.user.id,
          organization: req.user.organization,
        });
        imported += 1;
      } catch (err) {
        errors.push(`${group.returnNumber || group.vendorName}: ${err.message}`);
      }
    }

    res.json({ imported, total: groups.size, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error("Bulk import purchase returns error:", err);
    res.status(500).json({ error: err.message });
  }
};
