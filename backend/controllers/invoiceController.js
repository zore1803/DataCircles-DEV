const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");
const htmlDocumentPdf = require("../utils/htmlDocumentPdf");
const getDefaultBankDetails = require("../utils/getDefaultBankDetails");
const Branding = require("../models/Branding");
const mongoose = require("mongoose");
const Deal = require("../models/Deal");
const DocumentSettings = require("../models/DocumentSettings");
const { getDocumentSettingsForOrganization, resolveDocumentNumber } = require("../utils/documentNumbering");
const sendPaymentEmail = require("../utils/sendPaymentEmail");
const sendSMS = require("../utils/sendSMS");
const sendGridMail = require("../utils/sendGridMail");
const { syncDocumentStock } = require("../utils/inventorySync");

const calculateItemAmount = (item) => {
  const rate = parseFloat(item.rate) || 0;
  const quantity = parseInt(item.quantity) || 0;
  const subtotal = rate * quantity;
  const discount = parseFloat(item.discount) || 0;
  if (item.discountType === "percentage") {
    return subtotal * (1 - discount / 100);
  }
  return subtotal - discount;
};

const calculateTotalAmount = (
  items,
  discount,
  gstRate = 18,
  transactionType = "intra"
) => {
  const subtotal = items.reduce(
    (total, item) => total + calculateItemAmount(item),
    0
  );
  let netAmount = subtotal;
  if (discount && discount.value > 0) {
    if (discount.type === "percentage") {
      netAmount = subtotal * (1 - discount.value / 100);
    } else {
      netAmount = subtotal - discount.value;
    }
  }
  if (gstRate > 0) {
    const taxRate = transactionType === "intra" ? gstRate / 2 : gstRate; // For intra, CGST + SGST = full GST
    const totalTax = netAmount * (gstRate / 100);
    netAmount += totalTax;
  }
  return netAmount;
};

const createInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      deal,
      date,
      dueDate,
      amount,
      discount,
      status,
      items,
      style,
      notes,
      terms,
      isTaxInvoice,
      signature,
      signatureType,
      receiverGSTIN,
      transactionType,
      gstRate,
      invoicePrefix,
      invoiceSuffix,
      invoiceNumber,
      nextInvoiceNumber,
      billingAddress,
      shippingAddress,
    } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Items array is required and must not be empty" });
    }

    // Validate item-level discounts
    for (const item of items) {
      if (
        item.discountType &&
        !["amount", "percentage"].includes(item.discountType)
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          error: `Invalid discount type for item ${item.name}: must be 'amount' or 'percentage'`,
        });
      }
      if (item.discount < 0) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: `Discount for item ${item.name} cannot be negative` });
      }
      if (item.discountType === "percentage" && item.discount > 100) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          error: `Percentage discount for item ${item.name} cannot exceed 100%`,
        });
      }
    }

    // Validate invoice-level discount
    if (!discount || !["percentage", "fixed"].includes(discount.type)) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Discount type must be 'percentage' or 'fixed'" });
    }
    if (discount.value < 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Invoice discount value cannot be negative" });
    }
    if (discount.type === "percentage" && discount.value > 100) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Invoice percentage discount cannot exceed 100%" });
    }

    // Validate GST fields if tax invoice
    if (isTaxInvoice) {
      if (!["intra", "inter"].includes(transactionType)) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: "Transaction type must be 'intra' or 'inter'" });
      }
      if (gstRate < 0 || gstRate > 100) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: "GST rate must be between 0 and 100" });
      }
    }

    // Verify amount calculation
    // const calculatedAmount = calculateTotalAmount(items, discount, gstRate || 18, transactionType || 'intra');
    // if (Math.abs(calculatedAmount - amount) > 0.01) {
    //   await session.abortTransaction();
    //   session.endSession();
    //   return res.status(400).json({ error: "Provided amount does not match calculated amount" });
    // }

    // Invoice number: Document Settings' configured prefix
    // (documentTypeSettings.invoice.prefix) is the source of truth when the
    // client doesn't send one. Numbering is scoped to the resolved prefix
    // specifically (via resolveDocumentNumber, shared with the other 3
    // document types) so switching prefixes restarts/resumes cleanly instead
    // of continuing whichever prefix happened to be used most recently.
    const documentSettings = await getDocumentSettingsForOrganization(req.user.organization);
    const effectivePrefix = (invoicePrefix ?? documentSettings.documentTypeSettings?.invoice?.prefix ?? documentSettings.invoicePrefix ?? "").toString().trim() || "INV-";
    const effectiveSuffix = (invoiceSuffix ?? documentSettings.documentTypeSettings?.invoice?.suffix ?? documentSettings.invoiceSuffix ?? "").toString().trim();
    const explicitNumber = typeof invoiceNumber === "string" && invoiceNumber.trim()
      ? invoiceNumber.trim()
      : null;

    let finalInvoiceNumber;
    try {
      finalInvoiceNumber = await resolveDocumentNumber({
        Model: Invoice,
        numberField: "invoiceNumber",
        organization: req.user.organization,
        documentTypeKey: "invoice",
        prefix: effectivePrefix,
        suffix: effectiveSuffix,
        providedNumber: explicitNumber,
        session,
      });
    } catch (numErr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: numErr.message });
    }

    const hasCustomInvoiceDetails = typeof invoicePrefix !== "undefined" || typeof invoiceSuffix !== "undefined";
    if (hasCustomInvoiceDetails || !documentSettings || !documentSettings.invoicePrefix) {
      await DocumentSettings.findOneAndUpdate(
        { organization: req.user.organization },
        { $set: { invoicePrefix: effectivePrefix, invoiceSuffix: invoiceSuffix ?? documentSettings.invoiceSuffix } },
        { upsert: true, new: true, session }
      );
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

    const invoice = new Invoice({
      deal,
      date,
      dueDate,
      amount,
      discount,
      status,
      items,
      style,
      notes,
      terms,
      isTaxInvoice,
      signature,
      signatureType,
      receiverGSTIN: finalReceiverGSTIN,
      billingAddress: finalBillingAddress,
      shippingAddress: finalShippingAddress,
      transactionType: isTaxInvoice ? transactionType || "intra" : undefined,
      gstRate: isTaxInvoice ? gstRate || 18 : undefined,
      invoiceNumber: finalInvoiceNumber,
      user: req.user.id,
      organization: req.user.organization,
    });

    await invoice.save({ session });

    await syncDocumentStock({
      organization: req.user.organization,
      documentId: invoice._id,
      documentModel: 'Invoice',
      documentNumber: finalInvoiceNumber,
      items: invoice.items,
      previousItems: [],
      baseDirection: 'out',
      userId: req.user.id,
      reason: 'sale',
      isReversal: false,
      session
    });
    
    invoice.stockMovementStatus = 'applied';
    await invoice.save({ session, validateModifiedOnly: true });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(invoice);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

// Duplicate: clones an existing invoice into a brand-new Draft invoice with
// a freshly generated number. Does not touch the source invoice, and never
// carries over payments/digitalSignature/timestamps or the old number.
const duplicateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const source = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!source) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Invoice not found" });
    }

    const documentSettings = await getDocumentSettingsForOrganization(req.user.organization);
    const effectivePrefix = (documentSettings.documentTypeSettings?.invoice?.prefix ?? documentSettings.invoicePrefix ?? "").toString().trim() || "INV-";
    const effectiveSuffix = (documentSettings.documentTypeSettings?.invoice?.suffix ?? documentSettings.invoiceSuffix ?? "").toString().trim();

    let newInvoiceNumber;
    try {
      newInvoiceNumber = await resolveDocumentNumber({
        Model: Invoice,
        numberField: "invoiceNumber",
        organization: req.user.organization,
        documentTypeKey: "invoice",
        prefix: effectivePrefix,
        suffix: effectiveSuffix,
        providedNumber: null,
        session,
      });
    } catch (numErr) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: numErr.message });
    }

    // Bulk signature updates write via updateMany (no schema validation), so
    // older invoices can carry a signatureType like "image" that the
    // ['text','upload'] enum never actually allowed. A new document's .save()
    // does validate, so that stale value must be normalized here rather than
    // copied straight through.
    const validSignatureTypes = ["text", "upload"];
    const normalizedSignatureType = validSignatureTypes.includes(source.signatureType)
      ? source.signatureType
      : (source.signature ? "upload" : "text");

    const duplicate = new Invoice({
      deal: source.deal,
      date: new Date(),
      amount: source.amount,
      discount: source.discount,
      status: "Draft",
      items: source.items,
      style: source.style,
      notes: source.notes,
      terms: source.terms,
      isTaxInvoice: source.isTaxInvoice,
      signature: source.signature,
      signatureType: normalizedSignatureType,
      receiverGSTIN: source.receiverGSTIN,
      billingAddress: source.billingAddress,
      shippingAddress: source.shippingAddress,
      transactionType: source.transactionType,
      gstRate: source.gstRate,
      invoiceNumber: newInvoiceNumber,
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
    res.status(500).json({ error: `Failed to duplicate invoice: ${err.message}` });
  }
};

const getAllInvoices = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { status: { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
        { receiverGSTIN: { $regex: search, $options: "i" } }, // Added receiverGSTIN to search
        { transactionType: { $regex: search, $options: "i" } },
        { gstRate: { $regex: search, $options: "i" } },
      ];
    }

    // own-only: restrict to invoices this user owns.
    if (req.ownOnly) {
      const ownFilter = { user: req.user._id };
      if (query.$or) {
        query = { organization: query.organization, $and: [{ $or: query.$or }, ownFilter] };
      } else {
        Object.assign(query, ownFilter);
      }
    }

    const invoices = await Invoice.find(query).populate("deal");
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getInvoicesByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Find all deals for this company
    const deals = await Deal.find({
      company: companyId,
      organization: req.user.organization,
    }).select("_id");

    const dealIds = deals.map((d) => d._id);

    // Find all invoices for these deals
    const invoices = await Invoice.find({
      deal: { $in: dealIds },
      organization: req.user.organization,
    }).populate("deal");

    // Calculate totals
    const summary = {
      totalInvoices: invoices.length,
      totalAmount: 0,
      amountPaid: 0,
      amountDue: 0,
      overdueAmount: 0,
    };

    invoices.forEach((invoice) => {
      summary.totalAmount += invoice.amount;

      if (invoice.status === "Paid") {
        summary.amountPaid += invoice.amount;
      } else {
        summary.amountDue += invoice.amount;

        // Check if overdue
        if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
          summary.overdueAmount += invoice.amount;
        }
      }
    });

    res.json({ invoices, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCompanyInvoiceSummary = async (req, res) => {
  try {
    const { companyId } = req.params;

    // Find all deals for this company
    const deals = await Deal.find({
      company: companyId,
      organization: req.user.organization,
    }).select("_id");

    const dealIds = deals.map((d) => d._id);

    // Fetch only the necessary fields to compute summary
    const invoices = await Invoice.find({
      deal: { $in: dealIds },
      organization: req.user.organization,
    }).select("amount status dueDate");

    const summary = {
      totalInvoices: invoices.length,
      totalAmount: 0,
      amountPaid: 0,
      amountDue: 0,
      overdueAmount: 0,
    };

    invoices.forEach((invoice) => {
      summary.totalAmount += invoice.amount;

      if (invoice.status === "Paid") {
        summary.amountPaid += invoice.amount;
      } else {
        summary.amountDue += invoice.amount;
        if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
          summary.overdueAmount += invoice.amount;
        }
      }
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllInvoicesPaginated = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Filter parameters
    const {
      search,
      status,
      sortBy = "invoiceNumber",
      sortOrder = "asc",
    } = req.query;

    // Build query object
    const query = { organization: req.user.organization };

    // Search functionality
    if (search) {
      const matchingDeals = await Deal.find(
        { organization: req.user.organization, title: { $regex: search, $options: "i" } },
        { _id: 1 }
      );
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { deal: { $in: matchingDeals.map((d) => d._id) } },
        { receiverGSTIN: { $regex: search, $options: "i" } }, // Added receiverGSTIN to search
        { transactionType: { $regex: search, $options: "i" } },
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

    // Status filter
    if (status) {
      query.status = status;
    }

    // own-only: restrict to invoices this user owns.
    if (req.ownOnly) {
      const ownFilter = { user: req.user._id };
      if (query.$or) {
        query.$and = query.$and ? [...query.$and, { $or: query.$or }, ownFilter] : [{ $or: query.$or }, ownFilter];
        delete query.$or;
      } else {
        query.$and = query.$and ? [...query.$and, ownFilter] : [ownFilter];
      }
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute queries in parallel for better performance
    const [invoices, totalCount] = await Promise.all([
      Invoice.find(query)
        .populate({ path: "deal", populate: [{ path: "company", select: "name email" }, { path: "contact", select: "name email" }] })
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      Invoice.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      invoices,
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
    console.error("Error fetching invoices:", error);
    res.status(500).json({
      error: "Failed to fetch invoices",
      message: error.message,
    });
  }
};

// A user with own-only permission may only touch invoices they own — shared
// here since getInvoiceById/updateInvoice/deleteInvoice all need the same check.
// record.user may be a raw ObjectId or, if a caller populates it, a User
// subdocument — handle both so a populated lookup doesn't false-negative.
const isOwnedByUser = (record, userId) => {
  const uid = userId.toString();
  const recordUserId = record.user?._id ?? record.user;
  return recordUserId?.toString() === uid;
};

const getMyInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({
      user: req.user.id,
      organization: req.user.organization,
    }).populate("deal");
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({
        path: "deal",
        populate: ["contact", "company"],
      })
      .populate("items.itemId");

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const OrgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    // The template comes from the document's own `style` when it has one,
    // otherwise from the organization's document settings — resolved inside
    // htmlDocumentPdf, which renders the same markup as the live preview.
    const copyType = ["original", "duplicate", "triplicate"].includes(req.query.copyType)
      ? req.query.copyType
      : "original";
    const pdfBuffer = await htmlDocumentPdf(invoice, bankDetails, OrgDetails, "tax", copyType);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Error downloading invoice:", err);
    res.status(500).json({ error: err.message });
  }
};

const deleteInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (req.ownOnly && !isOwnedByUser(invoice, req.user._id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: "You can only delete invoices you own" });
    }

    if (invoice.stockMovementStatus === 'applied') {
      await syncDocumentStock({
        organization: req.user.organization,
        documentId: invoice._id,
        documentModel: 'Invoice',
        documentNumber: invoice.invoiceNumber,
        items: invoice.items,
        previousItems: [],
        baseDirection: 'out',
        userId: req.user.id,
        reason: 'sale',
        isReversal: true,
        session
      });
    }

    await invoice.deleteOne({ session });
    
    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Invoice deleted successfully",
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

const updateInvoice = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      deal,
      date,
      dueDate,
      amount,
      discount,
      status,
      items,
      style,
      notes,
      terms,
      isTaxInvoice,
      signature,
      signatureType,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
      transactionType,
      gstRate,
    } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Items array is required and must not be empty" });
    }

    // Validate item-level discounts
    for (const item of items) {
      if (
        item.discountType &&
        !["amount", "percentage"].includes(item.discountType)
      ) {
        return res.status(400).json({
          error: `Invalid discount type for item ${item.name}: must be 'amount' or 'percentage'`,
        });
      }
      if (item.discount < 0) {
        return res
          .status(400)
          .json({ error: `Discount for item ${item.name} cannot be negative` });
      }
      if (item.discountType === "percentage" && item.discount > 100) {
        return res.status(400).json({
          error: `Percentage discount for item ${item.name} cannot exceed 100%`,
        });
      }
    }

    // Validate invoice-level discount
    if (!discount || !["percentage", "fixed"].includes(discount.type)) {
      return res
        .status(400)
        .json({ error: "Discount type must be 'percentage' or 'fixed'" });
    }
    if (discount.value < 0) {
      return res
        .status(400)
        .json({ error: "Invoice discount value cannot be negative" });
    }
    if (discount.type === "percentage" && discount.value > 100) {
      return res
        .status(400)
        .json({ error: "Invoice percentage discount cannot exceed 100%" });
    }

    // Validate GST fields if tax invoice
    if (isTaxInvoice) {
      if (!["intra", "inter"].includes(transactionType)) {
        return res
          .status(400)
          .json({ error: "Transaction type must be 'intra' or 'inter'" });
      }
      if (gstRate < 0 || gstRate > 100) {
        return res
          .status(400)
          .json({ error: "GST rate must be between 0 and 100" });
      }
    }

    // Verify amount calculation
    // const calculatedAmount = calculateTotalAmount(items, discount, gstRate || 18, transactionType || 'intra');
    // if (Math.abs(calculatedAmount - amount) > 0.01) {
    //   return res.status(400).json({ error: "Provided amount does not match calculated amount" });
    // }

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

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (req.ownOnly && !isOwnedByUser(invoice, req.user._id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: "You can only edit invoices you own" });
    }

    const previousItems = invoice.items.map(item => ({
      itemId: item.itemId,
      variantId: item.variantId || undefined,
      quantity: item.quantity
    }));

    // Update fields
    invoice.deal = deal;
    invoice.date = date;
    invoice.dueDate = dueDate;
    invoice.amount = amount;
    invoice.discount = discount;
    invoice.status = status;
    invoice.items = items;
    invoice.style = style;
    invoice.notes = notes;
    invoice.terms = terms;
    invoice.isTaxInvoice = isTaxInvoice;
    invoice.signature = signature;
    invoice.signatureType = signatureType;
    invoice.receiverGSTIN = finalReceiverGSTIN;
    invoice.billingAddress = finalBillingAddress;
    invoice.shippingAddress = finalShippingAddress;
    invoice.transactionType = isTaxInvoice ? transactionType || "intra" : undefined;
    invoice.gstRate = isTaxInvoice ? gstRate || 18 : undefined;

    await invoice.save({ session });

    if (invoice.stockMovementStatus === 'applied' || invoice.stockMovementStatus === 'pending') {
      await syncDocumentStock({
        organization: req.user.organization,
        documentId: invoice._id,
        documentModel: 'Invoice',
        documentNumber: invoice.invoiceNumber,
        items: invoice.items,
        previousItems: invoice.stockMovementStatus === 'applied' ? previousItems : [],
        baseDirection: 'out',
        userId: req.user.id,
        reason: 'sale',
        isReversal: invoice.status === 'Cancelled',
        session
      });
      invoice.stockMovementStatus = invoice.status === 'Cancelled' ? 'reversed' : 'applied';
      await invoice.save({ session, validateModifiedOnly: true });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Invoice updated successfully",
      invoice,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).session(session);

    if (!invoice) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Invoice not found" });
    }

    const oldStatus = invoice.status;
    invoice.status = status;

    if (status === 'Cancelled' && invoice.stockMovementStatus === 'applied') {
      await syncDocumentStock({
        organization: req.user.organization,
        documentId: invoice._id,
        documentModel: 'Invoice',
        documentNumber: invoice.invoiceNumber,
        items: invoice.items,
        previousItems: [],
        baseDirection: 'out',
        userId: req.user.id,
        reason: 'sale',
        isReversal: true,
        session
      });
      invoice.stockMovementStatus = 'reversed';
    }

    await invoice.save({ session, validateModifiedOnly: true });

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Invoice status updated successfully",
      invoice,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
  }
};

// Bulk status/signature updates — Quotation, Proforma Invoice, and Delivery
// Challan controllers already had these (used by the Accounting page's bulk
// toolbar); Invoice was the one document type missing them.
const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) {
      return res.status(400).json({ error: "ids and status are required" });
    }
    await Invoice.updateMany(
      { _id: { $in: ids }, organization: req.user.organization },
      { status }
    );
    res.json({ message: `Updated ${ids.length} invoices to status: ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const bulkUpdateSignature = async (req, res) => {
  try {
    const { ids, signature, signatureType } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ error: "ids are required" });
    }
    const docs = await Invoice.find({ _id: { $in: ids }, organization: req.user.organization }, '_id');
    const validIds = docs.map(d => d._id.toString());
    const failedIds = ids.filter(id => !validIds.includes(id));
    if (validIds.length > 0) {
      await Invoice.updateMany(
        { _id: { $in: validIds } },
        { signature: signature || "", signatureType: signatureType || "text" }
      );
    }
    res.json({ message: `Updated signature for ${validIds.length} invoices`, successfulIds: validIds, failedIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// controllers/invoiceController.js (append near other handlers)

const updateInvoiceNumber = async (req, res) => {
  try {
    const { invoiceNumber } = req.body;
    const invoiceId = req.params.id;

    if (
      !invoiceNumber ||
      typeof invoiceNumber !== "string" ||
      invoiceNumber.trim() === ""
    ) {
      return res.status(400).json({ error: "invoiceNumber is required" });
    }

    // Normalize if you prefer (trim)
    const normalized = invoiceNumber.trim();

    // Check duplicate within same organization for any invoice with same invoiceNumber
    const existing = await Invoice.findOne({
      invoiceNumber: normalized,
      organization: req.user.organization,
      _id: { $ne: invoiceId },
    });

    if (existing) {
      return res.status(409).json({ error: "Invoice number already exists" });
    }

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: invoiceId,
        organization: req.user.organization,
      },
      { invoiceNumber: normalized },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json({ message: "Invoice number updated successfully", invoice });
  } catch (err) {
    console.error("updateInvoiceNumber error:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.getInvoices = async (req, res) => {
  try {
    let filter = { organization: req.user.organization };

    if (req.user.role === "staff") {
      filter.user = req.user._id;
    }

    const invoices = await Invoice.find(filter).populate({ path: "deal", populate: [{ path: "company", select: "name email" }, { path: "contact", select: "name email" }] }).populate("user");

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const bulkEmailGrouped = async (req, res) => {
  try {
    const { ids, overrides } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }

    // Deduplicate IDs so one invoice can't appear twice in a group
    const uniqueIds = [...new Set(ids.map(String))];

    // Fetch all invoices in one query, scoped to the organisation for security
    const invoices = await Invoice.find({
      _id: { $in: uniqueIds },
      organization: req.user.organization,
    })
      .populate({ path: "deal", populate: { path: "company" } })
      .populate("items.itemId");

    // Group invoices by customer email; collect ones we can't send
    const emailMap = {};
    const skippedIds = [];
    const skippedReasons = [];

    for (const inv of invoices) {
      if (!inv.deal) {
        skippedIds.push(inv._id);
        skippedReasons.push("no deal linked");
        continue;
      }
      const email = (overrides && overrides[inv._id]) || inv.deal?.company?.email;
      if (!email) {
        skippedIds.push(inv._id);
        skippedReasons.push("no customer email");
        continue;
      }

      if (!emailMap[email]) {
        emailMap[email] = {
          email,
          customerName: inv.deal?.company?.name || inv.deal?.title || email,
          invoices: [],
        };
      }
      emailMap[email].invoices.push(inv);
    }

    // Fetch org/bank details once and reuse across all groups
    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const Branding = require("../models/Branding");
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    const successfulIds = [];
    const failedIds = [];

    // Send one email per customer group
    for (const group of Object.values(emailMap)) {
      const attachments = [];
      const pdfFailedInGroup = [];

      for (const inv of group.invoices) {
        try {
          const pdfBuffer = await htmlDocumentPdf(inv, bankDetails, orgDetails, "tax");
          attachments.push({
            filename: `Invoice-${inv.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          });
        } catch (pdfErr) {
          console.error(
            `Failed to generate PDF for invoice ${inv._id}:`,
            pdfErr.message
          );
          pdfFailedInGroup.push(inv._id.toString());
          failedIds.push(inv._id.toString());
        }
      }

      // If every attachment failed, skip sending the email for this group
      if (attachments.length === 0) continue;

      try {
        await sendGridMail({
          replyTo: req.user.email,
          to: group.email,
          subject: `Your Invoices from ${orgDetails?.companyName || "Us"}`,
          text: `Dear ${group.customerName},\n\nPlease find attached your invoice(s).\n\nBest regards,\n${orgDetails?.companyName || ""}`,
          attachments,
        });
        // Mark the invoices whose PDFs were generated as successful
        for (const inv of group.invoices) {
          if (!pdfFailedInGroup.includes(inv._id.toString())) {
            successfulIds.push(inv._id.toString());
          }
        }
      } catch (mailErr) {
        console.error(`Failed to send email to ${group.email}:`, mailErr.message);
        for (const inv of group.invoices) {
          if (!pdfFailedInGroup.includes(inv._id.toString())) {
            failedIds.push(inv._id.toString());
          }
        }
      }
    }

    res.json({ successfulIds, failedIds, skippedIds, skippedReasons });
  } catch (error) {
    res.status(500).json({ error: `Failed to send grouped emails: ${error.message}` });
  }
};

// POST /api/invoices/:id/payments — record a payment against an invoice.
// The `payments` sub-schema already exists on the Invoice model; this was
// the missing piece — no route/controller ever pushed to it, so every
// "Save Payment" click hit a 404 and surfaced as "Failed to record payment".
const addInvoicePayment = async (req, res) => {
  try {
    const { amount, paymentDate, paymentMethod, reference, notes, internalNotes,
      notifyByEmail, customerEmail, notifyBySMS, customerPhone, signatureUrl } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "A valid payment amount greater than 0 is required." });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const alreadyPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
    const amountDue = invoice.amount - alreadyPaid;
    if (parsedAmount > amountDue + 0.01) {
      return res.status(400).json({ error: `Payment cannot exceed the remaining balance of ₹${amountDue.toFixed(2)}.` });
    }

    invoice.payments.push({
      amount: parsedAmount,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || "UPI",
      reference: reference || "",
      notes: notes || "",
      internalNotes: internalNotes || "",
      recordedBy: req.user._id,
      recordedAt: new Date(),
    });

    // Fully paid off → reflect it on the document's own status, same as the
    // manual status dropdown would, so the list/board view doesn't need a
    // separate signal to know this invoice is settled.
    const newTotalPaid = alreadyPaid + parsedAmount;
    if (newTotalPaid >= invoice.amount - 0.01) {
      invoice.status = "Paid";
    } else if (newTotalPaid > 0) {
      invoice.status = "Partially Paid";
    }

    // Recording a payment only touches `payments` and `status` — validating
    // the whole document would fail on unrelated legacy fields (e.g. an
    // older invoice with a `signatureType` value from before the enum was
    // tightened) that have nothing to do with this payment.
    await invoice.save({ validateModifiedOnly: true });

    // Non-blocking notifications — failure must never affect the payment save response
    const branding = (notifyByEmail || notifyBySMS)
      ? await Branding.findOne({ organization: req.user.organization }).lean()
      : null;

    if (notifyByEmail && customerEmail) {
      sendPaymentEmail({
        to: customerEmail,
        invoiceNumber: invoice.invoiceNumber,
        amount: parsedAmount,
        paymentDate,
        paymentMethod,
        reference,
        orgName: branding?.companyName,
        signatureUrl: signatureUrl || branding?.signatureUrl,
      }).catch((err) => console.error("Payment receipt email failed:", err.message));
    }

    if (notifyBySMS && customerPhone) {
      const orgName = branding?.companyName || "us";
      const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(parsedAmount);
      sendSMS({
        phone: customerPhone,
        message: `Payment of ${formatted} received for invoice ${invoice.invoiceNumber}. Thank you! - ${orgName}`,
      }).catch((err) => console.error("Payment receipt SMS failed:", err.message));
    }

    res.json({ message: "Payment recorded successfully", invoice });
  } catch (error) {
    res.status(500).json({ error: `Failed to record payment: ${error.message}` });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate("deal", "title")
      .populate("payments.recordedBy", "name email");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (req.ownOnly && !isOwnedByUser(invoice, req.user._id)) {
      return res.status(403).json({ error: "You can only view invoices you own" });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch invoice: ${error.message}` });
  }
};

const getInvoicePayments = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate("payments.recordedBy", "name email");
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json({ payments: invoice.payments, totalAmount: invoice.amount });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch payments: ${error.message}` });
  }
};

const updateInvoicePayment = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const payment = invoice.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    const { amount, paymentDate, paymentMethod, reference, notes, internalNotes } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "A valid payment amount greater than 0 is required." });
    }

    const otherPaid = (invoice.payments || [])
      .filter((p) => p._id.toString() !== req.params.paymentId)
      .reduce((sum, p) => sum + p.amount, 0);
    const amountDue = invoice.amount - otherPaid;
    if (parsedAmount > amountDue + 0.01) {
      return res.status(400).json({ error: `Payment cannot exceed the remaining balance of ₹${amountDue.toFixed(2)}.` });
    }

    payment.amount = parsedAmount;
    if (paymentDate) payment.paymentDate = new Date(paymentDate);
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    payment.reference = reference ?? payment.reference;
    payment.notes = notes ?? payment.notes;
    payment.internalNotes = internalNotes ?? payment.internalNotes;

    const newTotalPaid = otherPaid + parsedAmount;
    if (newTotalPaid >= invoice.amount - 0.01) {
      invoice.status = "Paid";
    } else if (newTotalPaid > 0) {
      invoice.status = "Partially Paid";
    } else {
      invoice.status = "Unpaid";
    }

    await invoice.save({ validateModifiedOnly: true });
    res.json({ message: "Payment updated successfully", invoice });
  } catch (error) {
    res.status(500).json({ error: `Failed to update payment: ${error.message}` });
  }
};

const deleteInvoicePayment = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const payment = invoice.payments.id(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    payment.deleteOne();

    const totalPaid = (invoice.payments || []).reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid >= invoice.amount - 0.01) {
      invoice.status = "Paid";
    } else if (totalPaid > 0) {
      invoice.status = "Partially Paid";
    } else {
      invoice.status = "Unpaid";
    }

    await invoice.save({ validateModifiedOnly: true });
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete payment: ${error.message}` });
  }
};

module.exports = {
  createInvoice,
  duplicateInvoice,
  getAllInvoices,
  getAllInvoicesPaginated,
  getMyInvoices,
  downloadInvoice,
  deleteInvoice,
  updateInvoice,
  updateStatus,
  bulkUpdateStatus,
  bulkUpdateSignature,
  getInvoicesByCompany,
  getCompanyInvoiceSummary,
  updateInvoiceNumber,
  bulkEmailGrouped,
  addInvoicePayment,
  getInvoiceById,
  getInvoicePayments,
  updateInvoicePayment,
  deleteInvoicePayment,
};
