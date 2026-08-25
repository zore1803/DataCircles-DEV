const Purchase = require("../models/Purchase");
const Vendor = require("../models/Vendor");
const PurchaseOrder = require("../models/PurchaseOrder");
const Branding = require("../models/Branding");
const Item = require("../models/Item");
const purchaseDocumentPdf = require("../utils/purchaseDocumentPdf");
const { syncDocumentStock } = require("../utils/inventorySync");

// A purchase's per-item Purchase Price / GST% (PurchaseForm.jsx's editable Amount/GST%
// fields) are an explicit "this is what it actually cost" entry — sync them back onto the
// product's own master record so the next purchase/document defaults to the new value,
// instead of only living inside this one purchase. Best-effort: a sync failure here must
// never fail the purchase itself, since the purchase already saved successfully.
async function syncItemMasterPricing(items, organizationId) {
  for (const item of items || []) {
    if (!item.itemId) continue;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const gstRate = parseFloat(item.gstRate) || 0;
    try {
      if (item.variantId) {
        await Item.updateOne(
          { _id: item.itemId, organization: organizationId, "variants._id": item.variantId },
          { $set: { "variants.$.purchasePrice": unitPrice, "variants.$.gstRate": gstRate } }
        );
      } else {
        await Item.updateOne(
          { _id: item.itemId, organization: organizationId },
          { $set: { purchasePrice: unitPrice, gstRate } }
        );
      }
    } catch (err) {
      console.error("Item master pricing sync failed for item", item.itemId, err);
    }
  }
}

// Helper function to calculate item total
const calculateItemTotal = (quantity, unitPrice) => {
  return parseFloat(quantity) * parseFloat(unitPrice);
};

// Helper function to calculate subtotal — legacy callers only (bulk import rows have no
// gstRate/taxInclusive, so this is equivalent to summing gross line totals for them).
const calculateSubtotal = (items) => {
  return items.reduce((sum, item) => sum + calculateItemTotal(item.quantity, item.unitPrice), 0);
};

// Computes one item's net (pre-tax) amount and tax amount from its own gstRate/taxInclusive —
// seeded from the variant when one was selected. Mirrors PurchaseForm.jsx's own frontend math
// exactly (lines computing `subtotal`/`totalTax`), so stored totals never disagree with what
// the form displayed.
const calculateItemNetAndTax = (quantity, unitPrice, gstRate, taxInclusive) => {
  const gross = (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  const rate = parseFloat(gstRate) || 0;
  if (rate <= 0) return { net: gross, tax: 0 };
  if (taxInclusive) {
    const net = gross / (1 + rate / 100);
    return { net, tax: gross - net };
  }
  return { net: gross, tax: gross * (rate / 100) };
};

// Rolls calculateItemNetAndTax up across every line into subtotal/totalTax/grandTotal —
// per-item GST, not a single document-level rate (see calculateItemNetAndTax's own comment).
const calculateOrderTotals = (items) => {
  let subtotal = 0;
  let totalTax = 0;
  for (const item of items) {
    const { net, tax } = calculateItemNetAndTax(item.quantity, item.unitPrice, item.gstRate, item.taxInclusive);
    subtotal += net;
    totalTax += tax;
  }
  return { subtotal, totalTax, grandTotal: subtotal + totalTax };
};

// Helper function to generate unique Purchase number per organization
async function generatePurchaseNumber(organizationId) {
  const count = await Purchase.countDocuments({ organization: organizationId });
  return `PUR-${(count + 1).toString().padStart(5, "0")}`;
}

// Create Purchase
exports.createPurchase = async (req, res) => {
  try {
    const { vendor, purchaseOrder, items, notes, status, transactionType } = req.body;

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

      // An Approved or Delivered PO can become a Purchase — Pending/Rejected
      // can't, since neither represents a confirmed order yet. Stock itself
      // only ever moves on the PO's own Delivered transition (see
      // purchaseOrderController's syncPurchaseOrderDeliveryStock), never here,
      // so converting from Approved (before delivery) is safe. Enforced here
      // (not just hidden in the UI) since this endpoint can be hit directly.
      if (poExists.status !== "Approved" && poExists.status !== "Delivered") {
        return res.status(400).json({
          message: `Only an Approved or Delivered Purchase Order can be converted to a Purchase (this one is "${poExists.status}").`,
        });
      }

      // Prevent duplicate conversion: Check if a Purchase already exists for this PO
      const duplicatePurchase = await Purchase.findOne({
        purchaseOrder,
        organization: req.user.organization
      });
      if (duplicatePurchase) {
        return res.status(400).json({ message: "A Purchase has already been created for this Purchase Order." });
      }
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    // Calculate subtotal/tax from each item's own GST (seeded from the variant when one was
    // selected) — not a single document-level rate, see calculateOrderTotals.
    const calculatedTransactionType = transactionType || 'intra';
    const { subtotal, totalTax, grandTotal } = calculateOrderTotals(items);

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
      totalTax,
      grandTotal,
      notes,
      // A Purchase created from a PO always starts as Pending, regardless of
      // what the caller sends — it's a real order awaiting payment, not a
      // draft. (Converting never moves stock either way — that only happens
      // on the PO's own Delivered transition.)
      status: purchaseOrder ? "Pending" : (status || "Draft"),
      user: req.user.id,
      organization: req.user.organization
    });

    await purchase.save();

    // Explicit user choice on this purchase — carry it back to the product master.
    await syncItemMasterPricing(purchase.items, req.user.organization);

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
        .populate("vendor", "name email phone")
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
    const { items, notes, status, purchaseOrder, transactionType } = req.body;

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!purchase) return res.status(404).json({ message: "Purchase not found" });

    // Paid is terminal — same rule as updatePurchaseStatus, applied here too
    // since this endpoint is also how the edit form changes status.
    if (purchase.status === "Paid" && status && status !== "Paid") {
      return res.status(400).json({ message: "A Paid purchase can't be changed to another status." });
    }

    // If items updated, recalc subtotal and item totals
    if (items) {
      const calculatedTransactionType = transactionType || purchase.transactionType;
      const { subtotal, totalTax, grandTotal } = calculateOrderTotals(items);

      purchase.items = items.map(item => ({
        ...item,
        total: calculateItemTotal(item.quantity, item.unitPrice) // Map 'amount' to 'total' if needed
      }));
      purchase.subtotal = subtotal;
      purchase.transactionType = calculatedTransactionType;
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

        // Same "must be Approved or Delivered" rule as createPurchase — see the comment there.
        if (poExists.status !== "Approved" && poExists.status !== "Delivered") {
          return res.status(400).json({
            message: `Only an Approved or Delivered Purchase Order can be converted to a Purchase (this one is "${poExists.status}").`,
          });
        }

        // Prevent duplicate conversion on edit
        const duplicatePurchase = await Purchase.findOne({
          purchaseOrder,
          organization: req.user.organization,
          _id: { $ne: req.params.id }
        });
        if (duplicatePurchase) {
          return res.status(400).json({ message: "Another Purchase has already been created for this Purchase Order." });
        }
      }
      purchase.purchaseOrder = purchaseOrder || null;
    }

    if (transactionType !== undefined) purchase.transactionType = transactionType;

    await purchase.save();

    // Explicit user choice on this purchase — carry it back to the product master (only
    // when items were actually part of this update, same as the recalc above).
    if (items) {
      await syncItemMasterPricing(purchase.items, req.user.organization);
    }

    // No inventory sync here: stock is moved exactly once, when the source
    // Purchase Order becomes Delivered (see purchaseOrderController's
    // syncPurchaseOrderDeliveryStock). This Purchase document is an
    // accounting/payment record only — its status (Draft/Pending/Paid/
    // Partial/Cancelled) must never touch stock, or the Delivered increase
    // would get counted twice.

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
    const validStatuses = ["Draft", "Pending", "Paid", "Partial", "Cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const oldPurchase = await Purchase.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!oldPurchase) return res.status(404).json({ message: "Purchase not found" });

    // Paid is terminal — a fully paid purchase can't be walked back through
    // the status dropdown. (Deleting/editing an individual payment via
    // Record Payment still recomputes status automatically — see
    // statusForPaidAmount — that's a payment-driven correction, not this
    // manual override.)
    if (oldPurchase.status === "Paid" && status !== "Paid") {
      return res.status(400).json({ message: "A Paid purchase can't be changed to another status." });
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

    // No forward inventory sync on Paid: stock moves exactly once, when the
    // source Purchase Order becomes Delivered — see purchaseOrderController's
    // syncPurchaseOrderDeliveryStock. Marking a Purchase Paid is payment/
    // accounting status only.
    //
    // Existing records from before this change may still carry
    // stockMovementStatus 'applied' (stock was increased under the old
    // Paid-triggers-stock behavior). Moving such a purchase off Paid still
    // reverses that earlier increase, so its ledger stays accurate — this is
    // the last remaining site that can flip 'applied' -> 'reversed'; nothing
    // sets it to 'applied' going forward.
    const oldStockMovementStatus = oldPurchase.stockMovementStatus;
    const wasReceived = oldPurchase.status === "Paid";
    const isNowReceived = status === "Paid";
    if (!isNowReceived && wasReceived && oldStockMovementStatus === 'applied') {
      await syncDocumentStock({
        organization: req.user.organization,
        documentId: purchase._id,
        documentModel: "Purchase",
        documentNumber: purchase.purchaseNumber,
        items: purchase.items,
        previousItems: [],
        baseDirection: "in",
        userId: req.user.id,
        reason: "adjustment",
        isReversal: true,
      });
      purchase.stockMovementStatus = 'reversed';
      await purchase.save({ validateModifiedOnly: true });
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
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    if (purchase.stockMovementStatus === 'applied') {
      await syncDocumentStock({
        organization: req.user.organization,
        documentId: purchase._id,
        documentModel: "Purchase",
        documentNumber: purchase.purchaseNumber,
        items: purchase.items,
        previousItems: [],
        baseDirection: "in",
        userId: req.user.id,
        reason: "adjustment",
        isReversal: true,
      });
    }

    await purchase.deleteOne();

    res.json({ message: "Purchase deleted successfully" });
  } catch (err) {
    console.error("Delete purchase error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Derives the payment-tracking status (Pending/Partial/Paid) from how much of
// grandTotal has actually been paid. Never touches Draft/Cancelled — those
// are set explicitly via the status dropdown/endpoint, not by paying.
function statusForPaidAmount(purchase, totalPaid) {
  // Cancelled is terminal — recording/removing a payment against a
  // cancelled Purchase (the UI blocks this, but the API doesn't) must not
  // resurrect it into Pending/Partial/Paid.
  if (purchase.status === "Cancelled") {
    return purchase.status;
  }
  // Draft becomes a real payment-tracked status the moment a payment is
  // actually recorded against it — staying "Draft" while carrying a full
  // payment would be misleading.
  if (totalPaid >= purchase.grandTotal - 0.01 && purchase.grandTotal > 0) {
    return "Paid";
  }
  if (totalPaid > 0) {
    return "Partial";
  }
  return purchase.status === "Draft" ? "Draft" : "Pending";
}

// GET Purchase Payments
exports.getPurchasePayments = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate("payments.recordedBy", "name email");
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });
    res.json({ payments: purchase.payments, totalAmount: purchase.grandTotal });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch payments: ${err.message}` });
  }
};

// POST Purchase Payment — records a payment made to the vendor against this
// Purchase, mirroring invoiceController.addInvoicePayment. Stock is never
// touched here — see the note on updatePurchase/updatePurchaseStatus above.
exports.addPurchasePayment = async (req, res) => {
  try {
    const { amount, paymentDate, paymentMethod, reference, notes, internalNotes } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "A valid payment amount greater than 0 is required." });
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    const alreadyPaid = (purchase.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const amountDue = purchase.grandTotal - alreadyPaid;
    if (parsedAmount > amountDue + 0.01) {
      return res.status(400).json({ error: `Payment cannot exceed the remaining balance of ₹${amountDue.toFixed(2)}.` });
    }

    purchase.payments.push({
      amount: parsedAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || "UPI",
      reference: reference || "",
      notes: notes || "",
      internalNotes: internalNotes || "",
      recordedBy: req.user._id,
      recordedAt: new Date(),
    });

    const newTotalPaid = alreadyPaid + parsedAmount;
    purchase.status = statusForPaidAmount(purchase, newTotalPaid);

    // Only `payments` and `status` changed — same reasoning as
    // invoiceController.addInvoicePayment (don't re-validate unrelated
    // legacy fields on an older purchase).
    await purchase.save({ validateModifiedOnly: true });
    await purchase.populate([
      { path: "vendor", select: "name email phone" },
      { path: "purchaseOrder", select: "poNumber vendor" },
      { path: "payments.recordedBy", select: "name email" },
    ]);

    res.json({ message: "Payment recorded successfully", purchase });
  } catch (err) {
    res.status(500).json({ error: `Failed to record payment: ${err.message}` });
  }
};

// PUT Purchase Payment
exports.updatePurchasePayment = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    const payment = purchase.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const { amount, paymentDate, paymentMethod, reference, notes, internalNotes } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "A valid payment amount greater than 0 is required." });
    }

    const otherPaid = (purchase.payments || [])
      .filter((p) => p._id.toString() !== req.params.paymentId)
      .reduce((sum, p) => sum + p.amount, 0);
    const amountDue = purchase.grandTotal - otherPaid;
    if (parsedAmount > amountDue + 0.01) {
      return res.status(400).json({ error: `Payment cannot exceed the remaining balance of ₹${amountDue.toFixed(2)}.` });
    }

    payment.amount = parsedAmount;
    if (paymentDate) payment.paymentDate = new Date(paymentDate);
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    payment.reference = reference ?? payment.reference;
    payment.notes = notes ?? payment.notes;
    payment.internalNotes = internalNotes ?? payment.internalNotes;

    purchase.status = statusForPaidAmount(purchase, otherPaid + parsedAmount);

    await purchase.save({ validateModifiedOnly: true });
    res.json({ message: "Payment updated successfully", purchase });
  } catch (err) {
    res.status(500).json({ error: `Failed to update payment: ${err.message}` });
  }
};

// DELETE Purchase Payment
exports.deletePurchasePayment = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    const payment = purchase.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    payment.deleteOne();

    const totalPaid = (purchase.payments || []).reduce((sum, p) => sum + p.amount, 0);
    purchase.status = statusForPaidAmount(purchase, totalPaid);

    await purchase.save({ validateModifiedOnly: true });
    res.json({ message: "Payment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete payment: ${err.message}` });
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

    const validStatuses = ["Draft", "Pending", "Paid", "Partial", "Cancelled"];
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
