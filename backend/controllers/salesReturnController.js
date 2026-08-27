const SalesReturn = require("../models/SalesReturn");
const Invoice = require("../models/Invoice");
const Deal = require("../models/Deal");
const Branding = require("../models/Branding");
const htmlDocumentPdf = require("../utils/htmlDocumentPdf");
const getDefaultBankDetails = require("../utils/getDefaultBankDetails");
const { syncDocumentStock } = require("../utils/inventorySync");

// Same math shape as invoiceController — kept parallel so return totals stay
// comparable line-for-line to the original invoice line values.
const calculateItemTotal = (quantity, unitPrice) => parseFloat(quantity) * parseFloat(unitPrice);
const calculateSubtotal = (items) =>
  items.reduce((sum, item) => sum + calculateItemTotal(item.quantity, item.unitPrice), 0);
const calculateTax = (subtotal, gstRate, transactionType) => {
  if (parseFloat(gstRate) <= 0) return 0;
  if (transactionType === "intra") {
    const half = parseFloat(gstRate) / 2;
    return subtotal * (half / 100) + subtotal * (half / 100);
  }
  return subtotal * (parseFloat(gstRate) / 100);
};

// Count-based "SR-00001" — mirrors PurchaseReturn.generateReturnNumber.
async function generateReturnNumber(organizationId) {
  const count = await SalesReturn.countDocuments({ organization: organizationId });
  return `SR-${(count + 1).toString().padStart(5, "0")}`;
}

const POPULATE = [
  { path: "deal", populate: [{ path: "contact", select: "name email phone" }, { path: "company", select: "name email phone gstin billingAddress shippingAddresses" }] },
  { path: "invoice", select: "invoiceNumber date deal amount" },
  { path: "items.itemId", select: "name description sellingPrice hsnSac gstRate variants type" },
];

// Applies the stock IN for a Sales Return transitioning into Confirmed.
// Mirrors purchaseReturnController.syncPurchaseReturnStock — but sales
// returns bring goods BACK into stock, so baseDirection is "in".
//
// oldStatus === Confirmed/Refunded means "already applied" — the delta
// branch handles item-quantity edits on an already-Confirmed return so the
// system never re-applies the full quantity on top of the previous one.
async function syncSalesReturnStock(salesReturn, oldStatus, oldStockMovementStatus, userId, previousItems = null) {
  const isNowConfirmed = salesReturn.status === "Confirmed" || salesReturn.status === "Refunded";
  const wasConfirmed = oldStatus === "Confirmed" || oldStatus === "Refunded";

  if (isNowConfirmed && !wasConfirmed && oldStockMovementStatus !== "applied") {
    await syncDocumentStock({
      organization: salesReturn.organization,
      documentId: salesReturn._id,
      documentModel: "SalesReturn",
      documentNumber: salesReturn.returnNumber,
      items: salesReturn.items,
      previousItems: [],
      baseDirection: "in",
      userId,
      reason: "return",
      isReversal: false,
    });
    salesReturn.stockMovementStatus = "applied";
    await salesReturn.save({ validateModifiedOnly: true });
    return;
  }

  if (oldStockMovementStatus === "applied" && previousItems) {
    await syncDocumentStock({
      organization: salesReturn.organization,
      documentId: salesReturn._id,
      documentModel: "SalesReturn",
      documentNumber: salesReturn.returnNumber,
      items: salesReturn.items,
      previousItems,
      baseDirection: "in",
      userId,
      reason: "return",
      isReversal: false,
    });
  }
}

// Once Confirmed, physical goods came back in — status can only move onward
// to Refunded (financial-only), never back to Draft/Pending/Cancelled.
function isBlockedStatusChange(oldStatus, newStatus) {
  if (oldStatus !== "Confirmed") return false;
  if (newStatus === undefined) return false;
  return newStatus !== "Confirmed" && newStatus !== "Refunded";
}

// Sum of quantities already returned across every OTHER non-Cancelled sales
// return against this invoice. Used to compute the returnable-remaining cap.
async function getReturnedQuantities(invoiceId, organization, excludeReturnId) {
  const match = {
    invoice: invoiceId,
    organization,
    status: { $ne: "Cancelled" },
  };
  if (excludeReturnId) match._id = { $ne: excludeReturnId };

  const rows = await SalesReturn.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: { itemId: "$items.itemId", variantId: "$items.variantId" },
        returned: { $sum: "$items.quantity" },
      },
    },
  ]);

  const map = new Map();
  for (const row of rows) {
    const key = `${row._id.itemId || ""}|${row._id.variantId || "none"}`;
    map.set(key, row.returned);
  }
  return map;
}

// GET /sales-returns/invoice/:invoiceId/available — hydrates the create/edit
// form: original invoice lines enriched with alreadyReturned + remaining.
// Services are excluded (they were never stocked, so they can't come back
// through inventory).
exports.getInvoiceItemsForReturn = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await Invoice.findOne({
      _id: invoiceId,
      organization: req.user.organization,
    })
      .populate({ path: "deal", populate: [{ path: "contact", select: "name email phone" }, { path: "company", select: "name email phone gstin billingAddress shippingAddresses" }] })
      .populate("items.itemId", "name description sellingPrice hsnSac gstRate variants type");

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const returnedMap = await getReturnedQuantities(invoice._id, req.user.organization, req.query.excludeReturnId);

    const items = invoice.items
      .filter((line) => line.itemId?.type !== "service")
      .map((line) => {
        const key = `${line.itemId?._id || line.itemId || ""}|${line.variantId || "none"}`;
        const alreadyReturned = returnedMap.get(key) || 0;
        const variant = line.variantId
          ? line.itemId?.variants?.find((v) => String(v._id) === String(line.variantId))
          : null;
        return {
          itemId: line.itemId?._id || line.itemId,
          variantId: line.variantId || null,
          variantName: variant?.name || null,
          parentItemId: line.parentItemId || null,
          isVariant: !!line.variantId,
          name: line.name,
          description: line.description || "",
          hsn: line.hsn || "",
          unitPrice: line.rate,
          gstRate: line.gstRate ?? invoice.gstRate ?? 0,
          taxInclusive: !!line.taxInclusive,
          originalQuantity: line.quantity,
          alreadyReturned,
          remaining: Math.max(0, line.quantity - alreadyReturned),
        };
      });

    res.json({
      invoice: {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        transactionType: invoice.transactionType,
        gstRate: invoice.gstRate,
        deal: invoice.deal,
      },
      items,
    });
  } catch (err) {
    console.error("Get invoice items for return error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Enforces max returnable per line — rejects a quantity that would push
// (already returned across other returns + this return) past the invoiced
// quantity. Shared by create & update (excludeReturnId omitted / set).
async function assertQuantitiesWithinInvoice(invoice, items, organization, excludeReturnId) {
  const returnedMap = await getReturnedQuantities(invoice._id, organization, excludeReturnId);

  for (const it of items) {
    const invoiceLine = invoice.items.find(
      (li) =>
        String(li.itemId?._id || li.itemId || "") === String(it.itemId || "") &&
        String(li.variantId || "none") === String(it.variantId || "none")
    );
    if (!invoiceLine) {
      throw new Error(`"${it.name}" is not part of the selected Invoice`);
    }
    if (invoiceLine.itemId?.type === "service") {
      throw new Error(`"${it.name}" is a service and cannot be returned through inventory`);
    }
    const key = `${it.itemId || ""}|${it.variantId || "none"}`;
    const alreadyReturned = returnedMap.get(key) || 0;
    const remaining = invoiceLine.quantity - alreadyReturned;
    if ((parseFloat(it.quantity) || 0) > remaining) {
      throw new Error(`Only ${remaining} unit(s) available to return for "${it.name}"`);
    }
    if ((parseFloat(it.quantity) || 0) <= 0) {
      throw new Error(`Return quantity for "${it.name}" must be greater than zero`);
    }
  }
}

exports.createSalesReturn = async (req, res) => {
  try {
    const { invoice, items, notes, reason, status, transactionType, gstRate, refundMode, refundReference, returnDate } = req.body;

    if (!invoice) return res.status(400).json({ message: "A Sales Return must reference an existing Invoice" });

    const invoiceDoc = await Invoice.findOne({ _id: invoice, organization: req.user.organization }).populate("items.itemId", "type");
    if (!invoiceDoc) return res.status(404).json({ message: "Invoice not found" });

    if (!items || items.length === 0) return res.status(400).json({ message: "At least one item is required" });

    await assertQuantitiesWithinInvoice(invoiceDoc, items, req.user.organization);

    const subtotal = calculateSubtotal(items);
    const txnType = transactionType || invoiceDoc.transactionType || "intra";
    const gst = parseFloat(gstRate ?? invoiceDoc.gstRate ?? 0) || 0;
    const totalTax = calculateTax(subtotal, gst, txnType);
    const grandTotal = subtotal + totalTax;

    const returnNumber = await generateReturnNumber(req.user.organization);

    const salesReturn = new SalesReturn({
      deal: invoiceDoc.deal,
      invoice,
      returnNumber,
      returnDate: returnDate || Date.now(),
      items: items.map((it) => ({
        ...it,
        total: calculateItemTotal(it.quantity, it.unitPrice),
      })),
      subtotal,
      transactionType: txnType,
      gstRate: gst,
      totalTax,
      grandTotal,
      status: status || "Draft",
      refundMode: refundMode || "",
      refundReference: refundReference || "",
      reason: reason || "",
      notes: notes || "",
      user: req.user.id,
      organization: req.user.organization,
    });

    await salesReturn.save();

    // Handles the "create directly as Confirmed" case (e.g. recording a
    // historical return). oldStatus null => never was Confirmed, so this
    // applies exactly once and is guarded by stockMovementStatus.
    await syncSalesReturnStock(salesReturn, null, salesReturn.stockMovementStatus, req.user.id);

    await salesReturn.populate(POPULATE);
    res.status(201).json(salesReturn);
  } catch (err) {
    console.error("Create sales return error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.getAllSalesReturns = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { organization: req.user.organization };
    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    const rows = await SalesReturn.find(query).populate(POPULATE).sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllSalesReturnsWithPagination = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;
    const { search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = { organization: req.user.organization };
    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;

    if (req.query.allIds === "true") {
      const all = await SalesReturn.find(query).select("_id").lean();
      return res.json({ ids: all.map((x) => x._id) });
    }

    const [salesReturns, totalCount] = await Promise.all([
      SalesReturn.find(query)
        .populate(POPULATE)
        .skip(skip)
        .limit(limit)
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .lean()
        .select("-__v"),
      SalesReturn.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    res.json({
      salesReturns,
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
    console.error("List sales returns error:", err);
    res.status(500).json({ error: "Failed to fetch sales returns", message: err.message });
  }
};

exports.getSalesReturnById = async (req, res) => {
  try {
    const row = await SalesReturn.findOne({ _id: req.params.id, organization: req.user.organization }).populate(POPULATE);
    if (!row) return res.status(404).json({ message: "Sales return not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!salesReturn) return res.status(404).json({ message: "Sales return not found" });

    const { items, notes, reason, status, transactionType, gstRate, refundMode, refundReference, returnDate } = req.body;

    const oldStatus = salesReturn.status;
    const oldStockMovementStatus = salesReturn.stockMovementStatus;

    if (isBlockedStatusChange(oldStatus, status)) {
      return res.status(400).json({ message: "A Confirmed Sales Return can only move to Refunded." });
    }

    // deal / invoice deliberately not editable — a return is against the
    // Invoice it was created for; changing either would silently invalidate
    // the already-returned/remaining math.
    if (returnDate !== undefined) salesReturn.returnDate = returnDate;
    if (notes !== undefined) salesReturn.notes = notes;
    if (reason !== undefined) salesReturn.reason = reason;
    if (status !== undefined) salesReturn.status = status;
    if (refundMode !== undefined) salesReturn.refundMode = refundMode;
    if (refundReference !== undefined) salesReturn.refundReference = refundReference;
    if (status === "Refunded" && !salesReturn.refundedAt) salesReturn.refundedAt = new Date();

    let previousItemsSnapshot = null;

    if (items !== undefined) {
      if (!items.length) return res.status(400).json({ message: "At least one item is required" });

      const invoiceDoc = await Invoice.findOne({ _id: salesReturn.invoice, organization: req.user.organization }).populate("items.itemId", "type");
      if (invoiceDoc) {
        await assertQuantitiesWithinInvoice(invoiceDoc, items, req.user.organization, salesReturn._id);
      }

      previousItemsSnapshot = salesReturn.items.map((it) => ({
        itemId: it.itemId,
        variantId: it.variantId,
        quantity: it.quantity,
      }));

      const txnType = transactionType || salesReturn.transactionType;
      const gst = gstRate !== undefined ? parseFloat(gstRate) || 0 : salesReturn.gstRate;
      const subtotal = calculateSubtotal(items);
      const totalTax = calculateTax(subtotal, gst, txnType);

      salesReturn.items = items.map((it) => ({ ...it, total: calculateItemTotal(it.quantity, it.unitPrice) }));
      salesReturn.subtotal = subtotal;
      salesReturn.transactionType = txnType;
      salesReturn.gstRate = gst;
      salesReturn.totalTax = totalTax;
      salesReturn.grandTotal = subtotal + totalTax;
    }

    await salesReturn.save();

    // Confirmed-transition stock IN, or delta stock IN for an already-
    // Confirmed edit. Idempotent via stockMovementStatus + previousItems.
    await syncSalesReturnStock(salesReturn, oldStatus, oldStockMovementStatus, req.user.id, previousItemsSnapshot);

    await salesReturn.populate(POPULATE);
    res.json(salesReturn);
  } catch (err) {
    console.error("Update sales return error:", err);
    res.status(400).json({ error: err.message });
  }
};

exports.updateSalesReturnStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["Draft", "Pending", "Confirmed", "Refunded", "Cancelled"];
    if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const salesReturn = await SalesReturn.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!salesReturn) return res.status(404).json({ message: "Sales return not found" });

    const oldStatus = salesReturn.status;
    const oldStockMovementStatus = salesReturn.stockMovementStatus;

    if (isBlockedStatusChange(oldStatus, status)) {
      return res.status(400).json({ message: "A Confirmed Sales Return can only move to Refunded." });
    }

    salesReturn.status = status;
    if (status === "Refunded" && !salesReturn.refundedAt) salesReturn.refundedAt = new Date();
    await salesReturn.save();

    await syncSalesReturnStock(salesReturn, oldStatus, oldStockMovementStatus, req.user.id);

    await salesReturn.populate(POPULATE);
    res.json(salesReturn);
  } catch (err) {
    console.error("Update sales return status error:", err);
    res.status(400).json({ error: err.message });
  }
};

// Builds the plain object shape shared/documentTemplates.js's buildDocumentHtml
// (and htmlDocumentPdf, which wraps it) expects — same shape an Invoice
// document already has. Sales Return items don't carry a discount or `rate`
// field of their own (unitPrice + gstRate + taxInclusive, snapshotted from
// the original invoice line at creation), so they're mapped here rather than
// changing the shared renderer, which every other document type also relies
// on staying invoice-shaped.
function toPrintableDoc(salesReturn) {
  const deal = salesReturn.deal || {};
  const company = deal.company || {};
  return {
    deal,
    date: salesReturn.returnDate,
    dueDate: null,
    notes: salesReturn.reason
      ? `Reason: ${salesReturn.reason}${salesReturn.notes ? `\n${salesReturn.notes}` : ""}`
      : salesReturn.notes || "",
    terms: "",
    isTaxInvoice: (salesReturn.totalTax || 0) > 0,
    receiverGSTIN: company.gstin || "",
    billingAddress: company.billingAddress || {},
    shippingAddress: company.shippingAddresses?.[0] || {},
    transactionType: salesReturn.transactionType,
    gstRate: salesReturn.gstRate,
    returnNumber: salesReturn.returnNumber,
    organization: salesReturn.organization,
    items: (salesReturn.items || []).map((it) => ({
      name: it.name,
      description: it.description || "",
      hsn: it.hsn || "",
      rate: it.unitPrice,
      quantity: it.quantity,
      discountType: "amount",
      discount: 0,
      gstRate: it.gstRate,
      taxInclusive: it.taxInclusive,
    })),
    discount: { type: "fixed", value: 0 },
  };
}

exports.toPrintableDoc = toPrintableDoc;

exports.downloadSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate({
      path: "deal",
      populate: ["contact", "company"],
    });

    if (!salesReturn) return res.status(404).json({ error: "Sales return not found" });

    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const orgDetails = await Branding.findOne({ organization: req.user.organization }).sort({ updatedAt: -1 });

    const copyType = ["original", "duplicate", "triplicate"].includes(req.query.copyType)
      ? req.query.copyType
      : "original";

    const pdfBuffer = await htmlDocumentPdf(toPrintableDoc(salesReturn), bankDetails, orgDetails, "salesReturn", copyType);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Sales-Return-${salesReturn.returnNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Error downloading sales return:", err);
    res.status(500).json({ error: err.message });
  }
};

// Bulk import — groups CSV rows by returnNumber::invoiceNumber (case-
// insensitive) into one SalesReturn per group with multiple line items,
// mirroring purchaseReturnController.bulkImportPurchaseReturns's grouping
// strategy. Unlike a Purchase Return import (which free-types item/rate),
// every row here must resolve against a real Invoice line so the historical
// rate/GST/taxInclusive values and the returnable-quantity cap are enforced
// exactly the same as the interactive form — the CSV can't invent prices or
// bypass the "can't return more than was sold" rule.
exports.bulkImportSalesReturns = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows to import" });
    }

    const groups = new Map();
    for (const row of rows) {
      const invoiceNumber = (row.invoiceNumber || "").trim();
      const itemName = (row.itemName || "").trim();
      if (!invoiceNumber || !itemName) continue;

      const groupKey = `${(row.returnNumber || "").trim().toLowerCase()}::${invoiceNumber.toLowerCase()}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          returnNumber: (row.returnNumber || "").trim(),
          invoiceNumber,
          status: row.status || "Draft",
          refundMode: row.refundMode || "",
          reason: row.reason || "",
          notes: row.notes || "",
          returnDate: row.returnDate || undefined,
          lines: [],
        });
      }
      groups.get(groupKey).lines.push({
        itemName,
        quantity: parseFloat(row.quantity) || 1,
      });
    }

    let imported = 0;
    const errors = [];

    for (const group of groups.values()) {
      try {
        const invoiceDoc = await Invoice.findOne({
          invoiceNumber: { $regex: `^${group.invoiceNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
          organization: req.user.organization,
        }).populate("items.itemId", "type");

        if (!invoiceDoc) {
          errors.push(`${group.invoiceNumber}: Invoice not found`);
          continue;
        }

        const items = [];
        for (const line of group.lines) {
          const invoiceLine = invoiceDoc.items.find(
            (li) => (li.name || "").trim().toLowerCase() === line.itemName.toLowerCase()
          );
          if (!invoiceLine) {
            errors.push(`${group.invoiceNumber}: "${line.itemName}" is not on this invoice`);
            continue;
          }
          if (invoiceLine.itemId?.type === "service") {
            errors.push(`${group.invoiceNumber}: "${line.itemName}" is a service and cannot be returned`);
            continue;
          }
          items.push({
            itemId: invoiceLine.itemId?._id || invoiceLine.itemId,
            variantId: invoiceLine.variantId || null,
            parentItemId: invoiceLine.parentItemId || null,
            isVariant: !!invoiceLine.variantId,
            name: invoiceLine.name,
            description: invoiceLine.description || "",
            hsn: invoiceLine.hsn || "",
            quantity: line.quantity,
            unitPrice: invoiceLine.rate,
            gstRate: invoiceLine.gstRate ?? invoiceDoc.gstRate ?? 0,
            taxInclusive: !!invoiceLine.taxInclusive,
          });
        }

        if (items.length === 0) continue;

        await assertQuantitiesWithinInvoice(invoiceDoc, items, req.user.organization);

        const subtotal = calculateSubtotal(items);
        const txnType = invoiceDoc.transactionType || "intra";
        const gst = parseFloat(invoiceDoc.gstRate) || 0;
        const totalTax = calculateTax(subtotal, gst, txnType);
        const returnNumber = group.returnNumber || (await generateReturnNumber(req.user.organization));

        const salesReturn = new SalesReturn({
          deal: invoiceDoc.deal,
          invoice: invoiceDoc._id,
          returnNumber,
          returnDate: group.returnDate || Date.now(),
          items: items.map((it) => ({ ...it, total: calculateItemTotal(it.quantity, it.unitPrice) })),
          subtotal,
          transactionType: txnType,
          gstRate: gst,
          totalTax,
          grandTotal: subtotal + totalTax,
          status: group.status,
          refundMode: group.refundMode,
          reason: group.reason,
          notes: group.notes,
          user: req.user.id,
          organization: req.user.organization,
        });

        await salesReturn.save();
        await syncSalesReturnStock(salesReturn, null, salesReturn.stockMovementStatus, req.user.id);

        imported += 1;
      } catch (err) {
        errors.push(`${group.invoiceNumber}: ${err.message}`);
      }
    }

    res.json({ imported, total: groups.size, errors: errors.length ? errors : undefined });
  } catch (err) {
    console.error("Bulk import sales returns error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSalesReturn = async (req, res) => {
  try {
    const salesReturn = await SalesReturn.findOne({ _id: req.params.id, organization: req.user.organization });
    if (!salesReturn) return res.status(404).json({ message: "Sales return not found" });

    // Reverse the stock IN if the return had already applied it — otherwise
    // deleting silently leaves inventory overstated with no surviving doc.
    if (salesReturn.stockMovementStatus === "applied") {
      await syncDocumentStock({
        organization: salesReturn.organization,
        documentId: salesReturn._id,
        documentModel: "SalesReturn",
        documentNumber: salesReturn.returnNumber,
        items: salesReturn.items,
        previousItems: [],
        baseDirection: "in",
        userId: req.user.id,
        reason: "adjustment",
        isReversal: true,
      });
    }

    await salesReturn.deleteOne();
    res.json({ message: "Sales return deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
