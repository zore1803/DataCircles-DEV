const SalesOrder = require("../models/SalesOrder");
const Invoice = require("../models/Invoice");
const getDefaultBankDetails = require("../utils/getDefaultBankDetails");
const Branding = require("../models/Branding");
const htmlDocumentPdf = require("../utils/htmlDocumentPdf");
const mongoose = require("mongoose");
const Deal = require("../models/Deal");
const { getDocumentSettingsForOrganization, resolveDocumentNumber } = require("../utils/documentNumbering");

// Attaches a `convertedInvoice` summary ({_id, invoiceNumber}) to each Sales
// Order so the frontend can show "already converted" / disable "Convert to
// Invoice" instead of only finding out when the create call 400s — same
// computed-at-read-time pattern purchaseOrderController uses for
// convertedPurchase (no stored two-way pointer to keep in sync).
async function attachConvertedInvoiceInfo(salesOrders, organizationId) {
  const list = Array.isArray(salesOrders) ? salesOrders : [salesOrders];
  const ids = list.map((so) => so._id).filter(Boolean);
  if (ids.length === 0) return salesOrders;

  const linkedInvoices = await Invoice.find({
    salesOrder: { $in: ids },
    organization: organizationId,
  }).select("_id invoiceNumber salesOrder").lean();

  const bySoId = new Map(linkedInvoices.map((inv) => [String(inv.salesOrder), inv]));

  list.forEach((so) => {
    const linked = bySoId.get(String(so._id));
    const summary = linked ? { _id: linked._id, invoiceNumber: linked.invoiceNumber } : null;
    if (so._doc) {
      so._doc.convertedInvoice = summary;
    } else {
      so.convertedInvoice = summary;
    }
  });

  return salesOrders;
}

// Create Sales Order
exports.createSalesOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      deal,
      date,
      dueDate,
      amount,
      status,
      items,
      notes,
      terms,
      transactionType,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
      salesOrderPrefix,
      salesOrderNumber: clientSalesOrderNumber,
      reference,
    } = req.body;

    const requiredFields = ["deal", "date", "amount", "discount"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "At least one item is required" });
    }
    for (const item of items) {
      if (!item.name || !item.rate || !item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: "All items must have name, rate, and quantity" });
      }
    }

    const documentSettings = await getDocumentSettingsForOrganization(req.user.organization);
    const finalPrefix = (salesOrderPrefix && salesOrderPrefix.trim()) || documentSettings.documentTypeSettings?.salesOrder?.prefix || "SO-";
    const finalSuffix = (documentSettings.documentTypeSettings?.salesOrder?.suffix ?? "").toString().trim();
    let salesOrderNumber;
    try {
      salesOrderNumber = await resolveDocumentNumber({
        Model: SalesOrder,
        numberField: "salesOrderNumber",
        organization: req.user.organization,
        documentTypeKey: "salesOrder",
        prefix: finalPrefix,
        suffix: finalSuffix,
        providedNumber: clientSalesOrderNumber && String(clientSalesOrderNumber).trim() ? clientSalesOrderNumber : null,
        session,
      });
    } catch (numErr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: numErr.message });
    }

    const dealDoc = await Deal.findById(deal).populate('company');
    let finalBillingAddress = billingAddress;
    let finalShippingAddress = shippingAddress;
    let finalReceiverGSTIN = receiverGSTIN;

    if (dealDoc && dealDoc.company) {
      if (!finalBillingAddress || Object.keys(finalBillingAddress).length === 0) {
        finalBillingAddress = dealDoc.company.billingAddress || {};
      }
      if (!finalShippingAddress || Object.keys(finalShippingAddress).length === 0) {
        finalShippingAddress = dealDoc.company.shippingAddresses?.[0] || {};
      }
      if (!finalReceiverGSTIN) {
        finalReceiverGSTIN = dealDoc.company.gstin || "";
      }
    }

    const salesOrder = new SalesOrder({
      deal,
      salesOrderPrefix: finalPrefix,
      salesOrderNumber,
      reference: reference || "",
      date,
      dueDate,
      amount,
      status: status || "Draft",
      items,
      notes: notes || "",
      terms: terms || "",
      transactionType: transactionType || "intra",
      signature,
      signatureType: signatureType || "text",
      discount: discount || { type: "fixed", value: 0 },
      receiverGSTIN: finalReceiverGSTIN,
      billingAddress: finalBillingAddress,
      shippingAddress: finalShippingAddress,
      user: req.user.id,
      organization: req.user.organization,
    });

    await salesOrder.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(salesOrder);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: `Failed to create sales order: ${err.message}` });
  }
};

// Duplicate: clones an existing sales order into a brand-new Draft sales
// order with a freshly generated number. Does not touch the source.
exports.duplicateSalesOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const source = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!source) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Sales Order not found" });
    }

    const documentSettings = await getDocumentSettingsForOrganization(req.user.organization);
    const finalPrefix = documentSettings.documentTypeSettings?.salesOrder?.prefix || "SO-";
    const finalSuffix = (documentSettings.documentTypeSettings?.salesOrder?.suffix ?? "").toString().trim();

    let newSalesOrderNumber;
    try {
      newSalesOrderNumber = await resolveDocumentNumber({
        Model: SalesOrder,
        numberField: "salesOrderNumber",
        organization: req.user.organization,
        documentTypeKey: "salesOrder",
        prefix: finalPrefix,
        suffix: finalSuffix,
        providedNumber: null,
        session,
      });
    } catch (numErr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: numErr.message });
    }

    const validSignatureTypes = ["text", "upload"];
    const normalizedSignatureType = validSignatureTypes.includes(source.signatureType)
      ? source.signatureType
      : (source.signature ? "upload" : "text");

    const duplicate = new SalesOrder({
      deal: source.deal,
      salesOrderPrefix: finalPrefix,
      salesOrderNumber: newSalesOrderNumber,
      reference: source.reference,
      date: new Date(),
      amount: source.amount,
      status: "Draft",
      items: source.items,
      notes: source.notes,
      terms: source.terms,
      isRoundOff: source.isRoundOff,
      transactionType: source.transactionType,
      signature: source.signature,
      signatureType: normalizedSignatureType,
      discount: source.discount,
      receiverGSTIN: source.receiverGSTIN,
      billingAddress: source.billingAddress,
      shippingAddress: source.shippingAddress,
      user: req.user.id,
      organization: req.user.organization,
      duplicatedFrom: source._id,
    });

    await duplicate.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(duplicate);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: `Failed to duplicate sales order: ${err.message}` });
  }
};

// Get All Sales Orders Paginated
exports.getAllSalesOrdersPaginated = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const skip = (page - 1) * limit;
    const {
      search,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = { organization: req.user.organization };

    if (req.query.allIds === "true") {
      if (search) {
        const matchingDeals = await Deal.find(
          { organization: req.user.organization, title: { $regex: search, $options: "i" } },
          { _id: 1 }
        );
        query.$or = [
          { salesOrderNumber: { $regex: search, $options: "i" } },
          { status: { $regex: search, $options: "i" } },
          { deal: { $in: matchingDeals.map((d) => d._id) } },
        ];
      }
      const ids = await SalesOrder.find(query).select("_id").lean();
      return res.json({ ids: ids.map((d) => d._id) });
    }

    if (search) {
      const matchingDeals = await Deal.find(
        { organization: req.user.organization, title: { $regex: search, $options: "i" } },
        { _id: 1 }
      );
      query.$or = [
        { salesOrderNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { deal: { $in: matchingDeals.map((d) => d._id) } },
        { receiverGSTIN: { $regex: search, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$amount" },
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }
    if (status) query.status = status;

    const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [salesOrders, totalCount] = await Promise.all([
      SalesOrder.find(query)
        .populate({ path: "deal", populate: ["contact", "company"] })
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      SalesOrder.countDocuments(query),
    ]);

    await attachConvertedInvoiceInfo(salesOrders, req.user.organization);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      salesOrders,
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
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch sales orders: ${error.message}` });
  }
};

// Get single Sales Order (used by the edit form / preview)
exports.getSalesOrderById = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate({ path: "deal", populate: ["contact", "company"] });

    if (!salesOrder) {
      return res.status(404).json({ error: "Sales Order not found" });
    }
    await attachConvertedInvoiceInfo(salesOrder, req.user.organization);
    res.json(salesOrder);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch sales order: ${err.message}` });
  }
};

// Download Sales Order
exports.downloadSalesOrder = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({ path: "deal", populate: ["contact", "company"] })
      .populate("items.itemId");

    if (!salesOrder) {
      return res.status(404).json({ error: "Sales Order not found" });
    }

    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    const copyType = ["original", "duplicate", "triplicate"].includes(req.query.copyType)
      ? req.query.copyType
      : "original";
    const pdfBuffer = await htmlDocumentPdf(salesOrder, bankDetails, orgDetails, "salesOrder", copyType);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=sales-order-${salesOrder.salesOrderNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: `Failed to download sales order: ${err.message}` });
  }
};

// Delete Sales Order
exports.deleteSalesOrder = async (req, res) => {
  try {
    const salesOrder = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!salesOrder) {
      return res.status(404).json({ error: "Sales Order not found" });
    }

    const linkedInvoice = await Invoice.findOne({
      salesOrder: salesOrder._id,
      organization: req.user.organization,
    }).select("_id");
    if (linkedInvoice) {
      return res.status(400).json({ error: "This Sales Order has already been converted to an Invoice and can't be deleted." });
    }

    await salesOrder.deleteOne();
    res.json({ message: "Sales order deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: `Failed to delete sales order: ${err.message}` });
  }
};

// Update Sales Order
exports.updateSalesOrder = async (req, res) => {
  try {
    const {
      deal,
      date,
      dueDate,
      amount,
      status,
      items,
      notes,
      terms,
      transactionType,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
      reference,
    } = req.body;

    const requiredFields = ["deal", "date", "amount", "discount"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    for (const item of items) {
      if (!item.name || !item.rate || !item.quantity) {
        return res.status(400).json({ error: "All items must have name, rate, and quantity" });
      }
    }

    const dealDoc = await Deal.findById(deal).populate('company');
    let finalBillingAddress = billingAddress;
    let finalShippingAddress = shippingAddress;
    let finalReceiverGSTIN = receiverGSTIN;

    if (dealDoc && dealDoc.company) {
      if (!finalBillingAddress || Object.keys(finalBillingAddress).length === 0) {
        finalBillingAddress = dealDoc.company.billingAddress || {};
      }
      if (!finalShippingAddress || Object.keys(finalShippingAddress).length === 0) {
        finalShippingAddress = dealDoc.company.shippingAddresses?.[0] || {};
      }
      if (!finalReceiverGSTIN) {
        finalReceiverGSTIN = dealDoc.company.gstin || "";
      }
    }

    const salesOrder = await SalesOrder.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      {
        deal,
        date,
        dueDate,
        amount,
        status,
        items,
        notes,
        terms,
        transactionType,
        signature,
        signatureType,
        discount,
        receiverGSTIN: finalReceiverGSTIN,
        billingAddress: finalBillingAddress,
        shippingAddress: finalShippingAddress,
        reference: reference || "",
      },
      { new: true }
    );

    if (!salesOrder) {
      return res.status(404).json({ error: "Sales Order not found" });
    }

    res.json({ message: "Sales order updated successfully", salesOrder });
  } catch (err) {
    res.status(500).json({ error: `Failed to update sales order: ${err.message}` });
  }
};

// Update Sales Order Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const salesOrder = await SalesOrder.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status },
      { new: true }
    );

    if (!salesOrder) {
      return res.status(404).json({ error: "Sales Order not found" });
    }

    res.json({ message: "Sales order status updated successfully", salesOrder });
  } catch (err) {
    res.status(500).json({ error: `Failed to update sales order status: ${err.message}` });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) {
      return res.status(400).json({ error: "ids and status are required" });
    }
    await SalesOrder.updateMany(
      { _id: { $in: ids }, organization: req.user.organization },
      { status }
    );
    res.json({ message: `Updated ${ids.length} sales orders to status: ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ error: "ids are required" });
    }
    const linked = await Invoice.find({
      salesOrder: { $in: ids },
      organization: req.user.organization,
    }).select("salesOrder");
    const linkedIds = new Set(linked.map((inv) => String(inv.salesOrder)));
    const deletableIds = ids.filter((id) => !linkedIds.has(String(id)));

    if (deletableIds.length > 0) {
      await SalesOrder.deleteMany({ _id: { $in: deletableIds }, organization: req.user.organization });
    }

    res.json({
      message: `Deleted ${deletableIds.length} sales orders`,
      deletedCount: deletableIds.length,
      skippedCount: ids.length - deletableIds.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
