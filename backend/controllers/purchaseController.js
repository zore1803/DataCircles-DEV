const Purchase = require("../models/Purchase");
const Vendor = require("../models/Vendor");
const PurchaseOrder = require("../models/PurchaseOrder");
const Branding = require("../models/Branding");
const purchaseDocumentPdf = require("../utils/purchaseDocumentPdf");

// Helper function to calculate item total
const calculateItemTotal = (quantity, unitPrice) => {
  return parseFloat(quantity) * parseFloat(unitPrice);
};

// Helper function to calculate subtotal
const calculateSubtotal = (items) => {
  return items.reduce((sum, item) => sum + calculateItemTotal(item.quantity, item.unitPrice), 0);
};

// Helper function to calculate tax
const calculateTax = (subtotal, gstRate, transactionType) => {
  if (parseFloat(gstRate) <= 0) return 0;
  if (transactionType === 'intra') {
    const halfRate = parseFloat(gstRate) / 2;
    const cgst = subtotal * (halfRate / 100);
    const sgst = subtotal * (halfRate / 100);
    return cgst + sgst;
  } else {
    return subtotal * (parseFloat(gstRate) / 100);
  }
};

// Helper function to generate unique Purchase number per organization
async function generatePurchaseNumber(organizationId) {
  const count = await Purchase.countDocuments({ organization: organizationId });
  return `PUR-${(count + 1).toString().padStart(5, "0")}`;
}

// Create Purchase
exports.createPurchase = async (req, res) => {
  try {
    const { vendor, purchaseOrder, items, notes, status, transactionType, gstRate } = req.body;

    // Validate vendor within organization
    const vendorExists = await Vendor.findOne({
      _id: vendor,
      organization: req.user.organization
    });
    if (!vendorExists) return res.status(404).json({ message: "Vendor not found" });

    // If purchaseOrder is provided, check it within organization
    if (purchaseOrder) {
      const poExists = await PurchaseOrder.findOne({
        _id: purchaseOrder,
        organization: req.user.organization
      });
      if (!poExists) return res.status(404).json({ message: "Purchase Order not found" });
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // Calculate subtotal
    const subtotal = calculateSubtotal(items);

    // Calculate tax and grand total
    const calculatedTransactionType = transactionType || 'intra';
    const calculatedGstRate = parseFloat(gstRate) || 0;
    const totalTax = calculateTax(subtotal, calculatedGstRate, calculatedTransactionType);
    const grandTotal = subtotal + totalTax;

    // Generate Purchase Number for organization
    const purchaseNumber = await generatePurchaseNumber(req.user.organization);

    const purchase = new Purchase({
      vendor,
      purchaseOrder: purchaseOrder || null,
      purchaseNumber,
      items: items.map(item => ({
        ...item,
        total: calculateItemTotal(item.quantity, item.unitPrice) // Map 'amount' to 'total' if needed
      })),
      subtotal,
      transactionType: calculatedTransactionType,
      gstRate: calculatedGstRate,
      totalTax,
      grandTotal,
      notes,
      status: status || "Draft",
      user: req.user.id,
      organization: req.user.organization
    });

    await purchase.save();

    // Populate references
    await purchase.populate([
      { path: 'vendor', select: 'name email phone' },
      { path: 'purchaseOrder', select: 'poNumber vendor' },
      { path: 'items.itemId', select: 'name description purchasePrice hsnSac gstRate' }
    ]);

    res.status(201).json(purchase);
  } catch (err) {
    console.error("Create purchase error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Get All Purchases
exports.getAllPurchases = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };
    
    if (search) {
      query.$or = [
        { purchaseNumber: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    const purchases = await Purchase.find(query)
      .populate("vendor", "name email")
      .populate("purchaseOrder", "poNumber vendor")
      .populate("items.itemId", "name description purchasePrice hsnSac gstRate")
      .sort({ createdAt: -1 });
    res.json(purchases);
  } catch (err) {
    console.error("Error fetching purchases:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Purchases with Pagination
exports.getAllPurchasesWithPagination = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const { search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    // Build query object
    let query = { organization: req.user.organization };
    
    // Search functionality
    if (search) {
      query.$or = [
        { purchaseNumber: { $regex: search, $options: 'i' } },
        { status: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { 'items.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status) {
      query.status = status;
    }
    
    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // "Select All" support: return every matching purchase's _id (ignoring
    // pagination) so the frontend can select all rows across every page, not
    // just the current page.
    if (req.query.allIds === 'true') {
      const allPurchases = await Purchase.find(query).select('_id').lean();
      return res.json({ ids: allPurchases.map((p) => p._id) });
    }

    // Execute queries in parallel for better performance
    const [purchases, totalCount] = await Promise.all([
      Purchase.find(query)
        .populate("vendor", "name email")
        .populate("purchaseOrder", "poNumber vendor")
        .populate("items.itemId", "name description purchasePrice hsnSac gstRate")
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean() // Returns plain JavaScript objects instead of Mongoose documents
        .select('-__v'), // Exclude version field
      Purchase.countDocuments(query)
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      purchases,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      }
    });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    res.status(500).json({ 
      error: 'Failed to fetch purchases',
      message: err.message 
    });
  }
};

// Get Purchases for a Vendor
exports.getPurchasesByVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;
    
    // Verify vendor belongs to organization
    const vendor = await Vendor.findOne({
      _id: vendorId,
      organization: req.user.organization
    });
    
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    
    const purchases = await Purchase.find({ 
      vendor: vendorId,
      organization: req.user.organization
    })
      .populate("vendor", "name email")
      .populate("purchaseOrder", "poNumber vendor")
      .populate("items.itemId", "name description purchasePrice hsnSac gstRate")
      .sort({ createdAt: -1 });
    res.json(purchases);
  } catch (err) {
    console.error("Error fetching vendor purchases:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Single Purchase
exports.getPurchaseById = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization
    })
      .populate("vendor", "name email phone")
      .populate("purchaseOrder", "poNumber vendor")
      .populate("items.itemId", "name description purchasePrice hsnSac gstRate");
      
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });
    res.json(purchase);
  } catch (err) {
    console.error("Error fetching purchase:", err);
    res.status(500).json({ error: err.message });
  }
};

// Update Purchase
exports.updatePurchase = async (req, res) => {
  try {
    const { items, notes, status, purchaseOrder, transactionType, gstRate } = req.body;

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    // If items updated, recalc subtotal and item totals
    if (items) {
      const subtotal = calculateSubtotal(items);
      const calculatedTransactionType = transactionType || purchase.transactionType;
      const calculatedGstRate = parseFloat(gstRate) || purchase.gstRate;
      const totalTax = calculateTax(subtotal, calculatedGstRate, calculatedTransactionType);
      const grandTotal = subtotal + totalTax;

      purchase.items = items.map(item => ({
        ...item,
        total: calculateItemTotal(item.quantity, item.unitPrice) // Map 'amount' to 'total' if needed
      }));
      purchase.subtotal = subtotal;
      purchase.transactionType = calculatedTransactionType;
      purchase.gstRate = calculatedGstRate;
      purchase.totalTax = totalTax;
      purchase.grandTotal = grandTotal;
    }

    if (notes !== undefined) purchase.notes = notes;
    if (status) purchase.status = status;

    if (purchaseOrder !== undefined) {
      if (purchaseOrder) {
        const poExists = await PurchaseOrder.findOne({
          _id: purchaseOrder,
          organization: req.user.organization
        });
        if (!poExists) return res.status(404).json({ message: "Purchase Order not found" });
      }
      purchase.purchaseOrder = purchaseOrder || null;
    }

    if (transactionType !== undefined) purchase.transactionType = transactionType;
    if (gstRate !== undefined) {
      const calculatedGstRate = parseFloat(gstRate);
      purchase.gstRate = calculatedGstRate;
      purchase.totalTax = calculateTax(purchase.subtotal, calculatedGstRate, purchase.transactionType);
      purchase.grandTotal = purchase.subtotal + purchase.totalTax;
    }

    await purchase.save();

    // Populate references
    await purchase.populate([
      { path: 'vendor', select: 'name email phone' },
      { path: 'purchaseOrder', select: 'poNumber vendor' },
      { path: 'items.itemId', select: 'name description purchasePrice hsnSac gstRate' }
    ]);

    res.json(purchase);
  } catch (err) {
    console.error("Update purchase error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Update only Status
exports.updatePurchaseStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Draft", "Pending", "Received", "Partial", "Cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const purchase = await Purchase.findOneAndUpdate(
      { 
        _id: req.params.id,
        organization: req.user.organization 
      },
      { status },
      { new: true }
    )
      .populate('vendor', 'name email phone')
      .populate('purchaseOrder', 'poNumber vendor')
      .populate('items.itemId', 'name description purchasePrice hsnSac gstRate');
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    res.json(purchase);
  } catch (err) {
    console.error("Update purchase status error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Delete Purchase
exports.deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    
    res.json({ message: "Purchase deleted successfully" });
  } catch (err) {
    console.error("Delete purchase error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Download Purchase as PDF — same rendered-server-side approach as
// invoiceController.downloadInvoice, but with its own template (see
// utils/purchaseDocumentPdf.js) since a Purchase's shape/direction (we're
// the buyer) doesn't fit shared/documentTemplates.js's invoice-family model.
exports.downloadPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate("vendor")
      .populate("items.itemId", "name description purchasePrice hsnSac gstRate");

    if (!purchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    const pdfBuffer = await purchaseDocumentPdf(
      purchase,
      orgDetails,
      purchase.vendor,
      "purchase"
    );

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=purchase-${purchase.purchaseNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Error downloading purchase:", err);
    res.status(500).json({ error: err.message });
  }
};

// Export Selected Purchases
exports.exportSelectedPurchases = async (req, res) => {
  try {
    const { selectedIds, columns } = req.body;

    if (!selectedIds || selectedIds.length === 0) {
      return res.status(400).json({ error: "No purchases selected for export" });
    }

    // Fetch every selected purchase regardless of pagination, scoped to the
    // org so one tenant can never export another's rows.
    const purchases = await Purchase.find({
      _id: { $in: selectedIds },
      organization: req.user.organization,
    })
      .populate("vendor", "name")
      .lean();

    const headerRow = columns.map((c) => `"${c.label}"`).join(",");

    const dataRows = purchases.map((purchase) =>
      columns
        .map((c) => {
          let val = "";

          if (c.key === "vendor") {
            val = purchase.vendor?.name || "";
          } else if (c.key === "items") {
            // Line items are a subdocument array; flatten to one readable cell.
            val = (purchase.items || [])
              .map((i) => `${i.name} x${i.quantity}`)
              .join("; ");
          } else {
            val = purchase[c.key] ?? "";
          }

          if (typeof val === "object" && val !== null) val = JSON.stringify(val);
          val = String(val).replace(/"/g, '""');

          return `"${val}"`;
        })
        .join(","),
    );

    const csvContent = [headerRow, ...dataRows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="Exported_Purchases.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error("Purchase export error:", error);
    res.status(500).json({ error: "Failed to export purchases" });
  }
};

// Bulk Import Purchases from CSV rows.
// Same flat "one row per item, vendor matched/created by name" pattern as
// Purchase Orders bulk import. Rows sharing the same purchaseNumber +
// vendorName are grouped into one Purchase with multiple line items.
exports.bulkImportPurchases = async (req, res) => {
  try {
    const { rows } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No purchase data provided" });
    }

    const organizationId = req.user.organization;

    const vendorCache = new Map();
    const resolveVendor = async (name) => {
      const key = name.trim().toLowerCase();
      if (vendorCache.has(key)) return vendorCache.get(key);
      let vendor = await Vendor.findOne({
        organization: organizationId,
        name: { $regex: `^${name.trim()}$`, $options: "i" },
      });
      if (!vendor) {
        vendor = await Vendor.create({
          name: name.trim(),
          organization: organizationId,
          user: req.user.id,
        });
      }
      vendorCache.set(key, vendor);
      return vendor;
    };

    const groups = new Map();
    let ungroupedIndex = 0;
    for (const row of rows) {
      if (!row.vendorName || !row.vendorName.trim()) continue;
      if (!row.itemName || !row.itemName.trim()) continue;
      const groupKey = row.purchaseNumber && row.purchaseNumber.trim()
        ? `${row.purchaseNumber.trim().toLowerCase()}::${row.vendorName.trim().toLowerCase()}`
        : `__row_${ungroupedIndex++}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          purchaseNumber: row.purchaseNumber?.trim() || null,
          vendorName: row.vendorName.trim(),
          status: row.status?.trim() || "Draft",
          notes: row.notes?.trim() || "",
          items: [],
        });
      }
      const quantity = parseFloat(row.quantity) || 0;
      const unitPrice = parseFloat(row.unitPrice) || 0;
      groups.get(groupKey).items.push({
        name: row.itemName.trim(),
        quantity,
        unitPrice,
        total: calculateItemTotal(quantity, unitPrice),
      });
    }

    if (groups.size === 0) {
      return res.status(400).json({
        error: "No valid rows found. Each row needs Vendor Name and Item Name.",
      });
    }

    const validStatuses = ["Draft", "Pending", "Received", "Partial", "Cancelled"];
    const errors = [];
    let imported = 0;

    for (const group of groups.values()) {
      try {
        const vendor = await resolveVendor(group.vendorName);
        const subtotal = calculateSubtotal(group.items);
        const purchaseNumber = group.purchaseNumber || (await generatePurchaseNumber(organizationId));
        const status = validStatuses.includes(group.status) ? group.status : "Draft";

        await Purchase.create({
          vendor: vendor._id,
          purchaseNumber,
          items: group.items,
          subtotal,
          grandTotal: subtotal,
          status,
          notes: group.notes,
          user: req.user.id,
          organization: organizationId,
        });
        imported++;
      } catch (err) {
        errors.push({ purchaseNumber: group.purchaseNumber, vendor: group.vendorName, message: err.message });
      }
    }

    res.json({
      message: `Imported ${imported} purchase${imported !== 1 ? "s" : ""}${errors.length ? `, ${errors.length} failed` : ""}`,
      imported,
      total: groups.size,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    console.error("Bulk import purchases error:", error);
    res.status(500).json({ error: "Failed to import purchases: " + error.message });
  }
};
