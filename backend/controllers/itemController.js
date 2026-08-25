const Item = require("../models/Item");
const StockMovement = require("../models/StockMovement");

// Normalizes the inventory block posted by the item form. Multipart requests deliver nested
// objects as strings, so the caller parses first and passes the resulting object here.
//
// `currentStock` is deliberately NOT read from client input on update: stock is owned by the
// StockMovement ledger and only ever changes through the inventory stock-in/stock-out endpoints.
// Letting the product edit form post a stale currentStock back would silently overwrite real
// stock levels and bypass the audit trail entirely.
function normalizeInventoryInput(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {};
  if (raw.lowStockThreshold !== undefined) {
    out.lowStockThreshold = Math.max(0, parseFloat(raw.lowStockThreshold) || 0);
  }
  if (raw.openingStock !== undefined) {
    out.openingStock = parseFloat(raw.openingStock) || 0;
  }
  return out;
}

// Helper: delete an S3 object by key, best-effort (mirrors brandingController.js)
async function deleteFileFromS3(key) {
  if (!key) return;

  const { DeleteObjectCommand, S3Client } = require("@aws-sdk/client-s3");

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key }));
  } catch (error) {
    console.error("Error deleting item image from S3:", error);
    // Don't fail the request if deletion fails
  }
}

function extractS3KeyFromUrl(url) {
  if (!url) return null;
  if (process.env.CLOUDFRONT_DOMAIN && url.includes(process.env.CLOUDFRONT_DOMAIN)) {
    return url.split(`${process.env.CLOUDFRONT_DOMAIN}/`)[1];
  }
  return null;
}

// Multer (multipart) requests send JSON-shaped fields as strings; parse them
// back before they hit the schema. No-op for plain JSON requests.
function parseJsonField(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Seeds the ledger so a tracked item's (or variant's) stock history starts from its opening
// balance rather than from its first manual movement. Best-effort: the item is already saved
// and correct, so a ledger failure is logged rather than failing the whole request.
async function recordOpeningStock({ organization, itemId, variantId, openingStock, unitPrice, userId }) {
  if (!openingStock) return;
  try {
    await StockMovement.create({
      organization,
      item: itemId,
      variantId: variantId || null,
      direction: openingStock >= 0 ? "in" : "out",
      quantity: Math.abs(openingStock),
      previousStock: 0,
      newStock: openingStock,
      reason: "opening_stock",
      notes: "Opening stock",
      unitPrice: unitPrice || 0,
      user: userId,
    });
  } catch (ledgerErr) {
    console.error("Failed to record opening stock movement:", ledgerErr);
  }
}

const createItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      user: req.user.id,
      organization: req.user.organization,
    };

    itemData.variants = parseJsonField(itemData.variants);
    itemData.additionalFields = parseJsonField(itemData.additionalFields);
    itemData.discount = parseJsonField(itemData.discount);

    // Inventory block from the item form. Every product is stock-tracked automatically, so this
    // is always populated (defaulting to a quantity of 0) rather than depending on an opt-in —
    // that's what makes a newly created product appear on the Inventory page immediately.
    // On create there's no ledger yet, so the opening stock becomes the starting currentStock
    // and gets its own ledger row after the item is saved.
    const inventoryInput = normalizeInventoryInput(parseJsonField(itemData.inventory)) || {};
    const opening = inventoryInput.openingStock || 0;
    itemData.inventory = {
      trackInventory: true,
      lowStockThreshold: inventoryInput.lowStockThreshold || 0,
      openingStock: opening,
      currentStock: opening,
      lastMovementAt: opening !== 0 ? new Date() : null,
    };

    // Validate and parse gstRate
    itemData.gstRate = parseFloat(itemData.gstRate) || 0;

    // Default discount + max discount cap
    if (itemData.discount) {
      itemData.discount = {
        type: itemData.discount.type === "amount" ? "amount" : "percentage",
        value: parseFloat(itemData.discount.value) || 0,
      };
    }
    itemData.maxDiscountPercent =
      itemData.maxDiscountPercent === "" || itemData.maxDiscountPercent === undefined || itemData.maxDiscountPercent === null
        ? null
        : parseFloat(itemData.maxDiscountPercent);

    // Uploaded product images (multipart requests only)
    if (req.files && req.files.length) {
      itemData.images = req.files.map((f) => `https://${process.env.CLOUDFRONT_DOMAIN}/${f.key}`);
    }

    // Validate variants if present
    if (itemData.variants && Array.isArray(itemData.variants)) {
      for (const variant of itemData.variants) {
        if (!variant.name || variant.name.trim() === "") {
          return res.status(400).json({ error: "Variant name is required" });
        }
        // Ensure numerical fields are properly formatted
        variant.purchasePrice = parseFloat(variant.purchasePrice) || 0;
        variant.sellingPrice = parseFloat(variant.sellingPrice) || 0;
        variant.stock = parseInt(variant.stock) || 0;
        variant.gstRate = parseFloat(variant.gstRate) || 0;
        variant.isActive = variant.isActive !== undefined ? variant.isActive : true;
        // Ensure attributes is a Map-like object
        variant.attributes = variant.attributes || {};
      }
    }
    const item = new Item(itemData);
    await item.save();

    await recordOpeningStock({
      organization: req.user.organization,
      itemId: item._id,
      openingStock: item.inventory?.openingStock,
      unitPrice: parseFloat(item.purchasePrice) || 0,
      userId: req.user.id,
    });

    // Every variant on a brand-new item is new, so each one with a starting stock gets its own
    // opening_stock ledger row too — same reasoning as the parent above.
    for (const variant of item.variants || []) {
      await recordOpeningStock({
        organization: req.user.organization,
        itemId: item._id,
        variantId: variant._id,
        openingStock: variant.stock,
        unitPrice: variant.purchasePrice,
        userId: req.user.id,
      });
    }

    res.status(201).json(item);
  } catch (err) {
    console.error("Create item error:", err);
    res.status(400).json({ error: err.message });
  }
};

const getAllItems = async (req, res) => {
  try {
    const { search, category, type, isActive, gstRate } = req.query;
    let query = { organization: req.user.organization }; // Filter by organization

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { hsnSac: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { "variants.name": { $regex: search, $options: "i" } }, // Search in variant names
        { "variants.sku": { $regex: search, $options: "i" } }, // Search in variant SKUs
      ];
    }

    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    if (type) {
      query.type = type;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (gstRate !== undefined) {
      query.gstRate = parseFloat(gstRate);
    }

    const items = await Item.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({ error: err.message });
  }
};

const getAllItemsPaginated = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Filter parameters
    const { search, category, type, isActive, gstRate, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    // Build query object
    let query = { organization: req.user.organization };

    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { hsnSac: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
        { "variants.name": { $regex: search, $options: "i" } }, // Search in variant names
        { "variants.sku": { $regex: search, $options: "i" } }, // Search in variant SKUs
      ];
    }

    // Category filter
    if (category) {
      query.category = { $regex: category, $options: "i" };
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Active status filter
    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // GST Rate filter
    if (gstRate !== undefined) {
      query.gstRate = parseFloat(gstRate);
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // "Select All" support: return every matching item's _id (ignoring
    // pagination) so the frontend can select all rows across every page, not
    // just the current page.
    if (req.query.allIds === "true") {
      const allItems = await Item.find(query).select("_id").lean();
      return res.json({ ids: allItems.map((i) => i._id) });
    }

    // Execute queries in parallel for better performance
    const [items, totalCount] = await Promise.all([
      Item.find(query)
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean() // Returns plain JavaScript objects instead of Mongoose documents
        .select("-__v"), // Exclude version field
      Item.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      items,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (err) {
    console.error("Error fetching items:", err);
    res.status(500).json({
      error: "Failed to fetch items",
      message: err.message,
    });
  }
};

const getItemById = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate("user", "name email");

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateItem = async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      user: req.user.id,
      organization: req.user.organization,
    };

    itemData.variants = parseJsonField(itemData.variants);
    itemData.additionalFields = parseJsonField(itemData.additionalFields);
    itemData.discount = parseJsonField(itemData.discount);
    const existingImages = parseJsonField(itemData.existingImages) || [];
    delete itemData.existingImages;

    // Only the two inventory SETTINGS are editable from the product form — never the stock level
    // itself. Assigning the whole posted object here would let a stale currentStock from the form
    // overwrite real stock and bypass the StockMovement ledger, so the incoming block is rebuilt
    // field-by-field with dot paths (which also avoids clobbering the untouched sub-fields).
    const inventoryInput = normalizeInventoryInput(parseJsonField(itemData.inventory));
    delete itemData.inventory;
    if (inventoryInput?.lowStockThreshold !== undefined) {
      itemData["inventory.lowStockThreshold"] = inventoryInput.lowStockThreshold;
    }

    // Validate and parse gstRate
    itemData.gstRate = parseFloat(itemData.gstRate) || 0;

    // Default discount + max discount cap
    if (itemData.discount) {
      itemData.discount = {
        type: itemData.discount.type === "amount" ? "amount" : "percentage",
        value: parseFloat(itemData.discount.value) || 0,
      };
    }
    itemData.maxDiscountPercent =
      itemData.maxDiscountPercent === "" || itemData.maxDiscountPercent === undefined || itemData.maxDiscountPercent === null
        ? null
        : parseFloat(itemData.maxDiscountPercent);

    // Merge kept existing images with any newly uploaded ones; best-effort
    // delete from S3 whatever the user removed (matches how branding's
    // logo/signature replacement behaves).
    if (req.files && req.files.length) {
      const newImages = req.files.map((f) => `https://${process.env.CLOUDFRONT_DOMAIN}/${f.key}`);
      itemData.images = [...existingImages, ...newImages];
    } else if (Array.isArray(existingImages)) {
      itemData.images = existingImages;
    }

    if (Array.isArray(itemData.images)) {
      const currentItem = await Item.findOne({ _id: req.params.id, organization: req.user.organization }).select("images").lean();
      const removedImages = (currentItem?.images || []).filter((url) => !itemData.images.includes(url));
      removedImages.forEach((url) => {
        const key = extractS3KeyFromUrl(url);
        if (key) deleteFileFromS3(key);
      });
    }

    // Validate variants if present. A variant already carrying an `_id` is one that already
    // exists (its `stock` field below is ignored by the frontend once the item exists — see
    // ItemForm.jsx's variant Stock lock — but is left as posted here as defense in depth: it's
    // simply never surfaced to the ledger). One with no `_id` is brand new and gets its own
    // opening_stock ledger row once saved, same as a parent item's opening stock.
    const newVariantIndexes = [];
    if (itemData.variants && Array.isArray(itemData.variants)) {
      itemData.variants.forEach((variant, idx) => {
        if (!variant.name || variant.name.trim() === "") {
          throw Object.assign(new Error("Variant name is required"), { status: 400 });
        }
        if (!variant._id) newVariantIndexes.push(idx);
        // Ensure numerical fields are properly formatted
        variant.purchasePrice = parseFloat(variant.purchasePrice) || 0;
        variant.sellingPrice = parseFloat(variant.sellingPrice) || 0;
        variant.stock = parseInt(variant.stock) || 0;
        variant.gstRate = parseFloat(variant.gstRate) || 0;
        variant.isActive = variant.isActive !== undefined ? variant.isActive : true;
        // Ensure attributes is a Map-like object
        variant.attributes = variant.attributes || {};
      });
    }

    const item = await Item.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      itemData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("user", "name email");

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    for (const idx of newVariantIndexes) {
      const variant = item.variants[idx];
      if (!variant) continue;
      await recordOpeningStock({
        organization: req.user.organization,
        itemId: item._id,
        variantId: variant._id,
        openingStock: variant.stock,
        unitPrice: variant.purchasePrice,
        userId: req.user.id,
      });
    }

    res.json(item);
  } catch (err) {
    console.error("Update item error:", err);
    res.status(400).json({ error: err.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await Item.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getItemCategories = async (req, res) => {
  try {
    const categories = await Item.distinct("category", {
      organization: req.user.organization,
      category: { $ne: "" },
    });
    res.json(categories.filter((cat) => cat && cat.trim() !== ""));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const toggleItemStatus = async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    item.isActive = !item.isActive;
    await item.save();

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const exportSelectedItems = async (req, res) => {
  try {
    const { selectedIds, columns } = req.body;

    if (!selectedIds || selectedIds.length === 0) {
      return res.status(400).json({ error: "No items selected for export" });
    }

    // Fetch every selected item regardless of pagination, scoped to the org
    // so one tenant can never export another's rows.
    const items = await Item.find({
      _id: { $in: selectedIds },
      organization: req.user.organization,
    }).lean();

    const headerRow = columns.map((c) => `"${c.label}"`).join(",");

    const dataRows = items.map((item) =>
      columns
        .map((c) => {
          let val = "";

          if (c.isCustomField) {
            const field = item.additionalFields?.find((f) => f.key === c.key);
            val = field ? field.value : "";
          } else if (c.key === "variants") {
            // Variants is an array subdocument; flatten to one readable cell.
            val = (item.variants || []).map((v) => v.name).filter(Boolean).join(", ");
          } else {
            val = item[c.key] ?? "";
          }

          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          val = String(val).replace(/"/g, '""');

          return `"${val}"`;
        })
        .join(","),
    );

    const csvContent = [headerRow, ...dataRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="Exported_Items.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Item export error:", error);
    res.status(500).json({ error: "Failed to export items" });
  }
};

module.exports = {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  getItemCategories,
  toggleItemStatus,
  getAllItemsPaginated,
  exportSelectedItems,
};