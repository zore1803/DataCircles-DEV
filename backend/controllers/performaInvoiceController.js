const PerformaInvoice = require("../models/ProformaInvoice");
const getDefaultBankDetails = require("../utils/getDefaultBankDetails");
const htmlDocumentPdf = require("../utils/htmlDocumentPdf");
const mongoose = require("mongoose");
const Branding = require("../models/Branding");
const Deal = require("../models/Deal");
const { getDocumentSettingsForOrganization, resolveDocumentNumber } = require("../utils/documentNumbering");

// Utility function to format date as YYYYMMDD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const createPerformaInvoice = async (req, res) => {
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
      style,
      notes,
      terms,
      isTaxInvoice,
      transactionType,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
      performaInvoicePrefix,
      performaInvoiceSuffix,
      performaInvoiceNumber: clientPerformaInvoiceNumber,
    } = req.body;

    // Validate required fields
    const requiredFields = ["deal", "date", "amount", "status", "discount"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "At least one item is required" });
    }
    for (const item of items) {
      if (!item.name || !item.rate || !item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res
          .status(400)
          .json({ error: "All items must have name, rate, and quantity" });
      }
    }

    const documentSettings = await getDocumentSettingsForOrganization(req.user.organization);
    // Same client-first, Document-Settings-fallback precedence the other three
    // document types use: a prefix/number typed into the form wins, otherwise
    // documentTypeSettings.proformaInvoice supplies it. Previously the client's
    // prefix and number were ignored entirely, so the form's numbering boxes
    // were editable but had no effect on the saved document.
    const finalPIPrefix = (performaInvoicePrefix && performaInvoicePrefix.trim()) || documentSettings.documentTypeSettings?.proformaInvoice?.prefix || "PI-";
    const finalPISuffix = (performaInvoiceSuffix ?? documentSettings.documentTypeSettings?.proformaInvoice?.suffix ?? "").toString().trim();
    let performaInvoiceNumber;
    try {
      performaInvoiceNumber = await resolveDocumentNumber({
        Model: PerformaInvoice,
        numberField: "performaInvoiceNumber",
        organization: req.user.organization,
        documentTypeKey: "proformaInvoice",
        prefix: finalPIPrefix,
        suffix: finalPISuffix,
        providedNumber: clientPerformaInvoiceNumber && String(clientPerformaInvoiceNumber).trim() ? clientPerformaInvoiceNumber : null,
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

    const performaInvoice = new PerformaInvoice({
      deal,
      date,
      dueDate,
      amount,
      status,
      items,
      style: style || "",
      notes: notes || "",
      terms: terms || "",
      isTaxInvoice: isTaxInvoice || false,
      transactionType: transactionType || 'intra',
      signature,
      signatureType: signatureType || "text",
      discount: discount || { type: "fixed", value: 0 },
      receiverGSTIN: finalReceiverGSTIN,
      billingAddress: finalBillingAddress,
      shippingAddress: finalShippingAddress,
      performaInvoiceNumber,
      user: req.user.id,
      organization: req.user.organization,
    });

    await performaInvoice.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(performaInvoice);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({ error: `Failed to create proformainvoice: ${err.message}` });
  }
};

const getAllPerformaInvoices = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      const matchingDeals = await Deal.find(
        { organization: req.user.organization, title: { $regex: search, $options: "i" } },
        { _id: 1 }
      );
      query.$or = [
        { status: { $regex: search, $options: "i" } },
        { performaInvoiceNumber: { $regex: search, $options: "i" } },
        { deal: { $in: matchingDeals.map((d) => d._id) } },
        { receiverGSTIN: { $regex: search, $options: "i" } }, // Added receiverGSTIN to search
      ];
    }

    const performaInvoices = await PerformaInvoice.find(query).populate("deal");
    res.json(performaInvoices);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to fetch proformainvoices: ${error.message}` });
  }
};

const getAllPerformaInvoicesPaginated = async (req, res) => {
  try {
    // Pagination parameters
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100); // Max 100 items per page
    const skip = (page - 1) * limit;

    // Filter parameters
    const {
      search,
      status,
      sortBy = "performaInvoiceNumber",
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
        { performaInvoiceNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { deal: { $in: matchingDeals.map((d) => d._id) } },
        { receiverGSTIN: { $regex: search, $options: "i" } }, // Added receiverGSTIN to search
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

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute queries in parallel for better performance
    const [performaInvoices, totalCount] = await Promise.all([
      PerformaInvoice.find(query)
        .populate("deal")
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      PerformaInvoice.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      performaInvoices,
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
    console.error("Error fetching proformainvoices:", error);
    res.status(500).json({
      error: "Failed to fetch proformainvoices",
      message: error.message,
    });
  }
};

const getMyPerformaInvoices = async (req, res) => {
  try {
    const performaInvoices = await PerformaInvoice.find({
      user: req.user.id,
      organization: req.user.organization,
    }).populate("deal");
    res.json(performaInvoices);
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to fetch proformainvoices: ${err.message}` });
  }
};

const downloadPerformaInvoice = async (req, res) => {
  try {
    const performaInvoice = await PerformaInvoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({
        path: "deal",
        populate: ["contact", "company"],
      })
      .populate("items.itemId");

    if (!performaInvoice) {
      return res.status(404).json({ error: "proformaInvoice not found" });
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
    const pdfBuffer = await htmlDocumentPdf(performaInvoice, bankDetails, OrgDetails, "performa", copyType);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=performa-invoice-${performaInvoice.performaInvoiceNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Error downloading proformainvoice:", err);
    res
      .status(500)
      .json({ error: `Failed to download proformainvoice: ${err.message}` });
  }
};

const deletePerformaInvoice = async (req, res) => {
  try {
    const performaInvoice = await PerformaInvoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!performaInvoice) {
      return res.status(404).json({ error: "proformaInvoice not found" });
    }

    await performaInvoice.deleteOne();
    res.json({
      message: "proformaInvoice deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to delete proformainvoice: ${err.message}` });
  }
};

const updatePerformaInvoice = async (req, res) => {
  try {
    const {
      deal,
      date,
      dueDate,
      amount,
      status,
      items,
      style,
      notes,
      terms,
      isTaxInvoice,
      transactionType,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
    } = req.body;

    // Validate required fields
    const requiredFields = ["deal", "date", "amount", "status", "discount"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res
          .status(400)
          .json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one item is required" });
    }
    for (const item of items) {
      if (!item.name || !item.rate || !item.quantity) {
        return res
          .status(400)
          .json({ error: "All items must have name, rate, and quantity" });
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

    const performaInvoice = await PerformaInvoice.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      {
        deal,
        date,
        dueDate,
        amount,
        status,
        items,
        style,
        notes,
        terms,
        isTaxInvoice,
        transactionType,
        signature,
        signatureType,
        discount,
        receiverGSTIN: finalReceiverGSTIN,
        billingAddress: finalBillingAddress,
        shippingAddress: finalShippingAddress,
      },
      { new: true }
    );

    if (!performaInvoice) {
      return res.status(404).json({ error: "proformaInvoice not found" });
    }

    res.json({
      message: "proformaInvoice updated successfully",
      performaInvoice,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to update proformainvoice: ${err.message}` });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const performaInvoice = await PerformaInvoice.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      { status },
      { new: true }
    );

    if (!performaInvoice) {
      return res.status(404).json({ error: "proformaInvoice not found" });
    }

    res.json({
      message: "proformaInvoice status updated successfully",
      performaInvoice,
    });
  } catch (err) {
    res.status(500).json({
      error: `Failed to update proformainvoice status: ${err.message}`,
    });
  }
};

// PATCH: Update Performa Invoice Number only
const updatePerformaInvoiceNumber = async (req, res) => {
  try {
    const { performaInvoiceNumber } = req.body;
    const { id } = req.params;

    if (!performaInvoiceNumber) {
      return res
        .status(400)
        .json({ message: "performaInvoiceNumber is required" });
    }

    // check duplicate
    const exists = await PerformaInvoice.findOne({
      performaInvoiceNumber,
      organization: req.user.organization,
      _id: { $ne: id },
    });

    if (exists) {
      return res.status(409).json({
        message: `Performa Invoice Number ${performaInvoiceNumber} already exists`,
      });
    }

    const updated = await PerformaInvoice.findOneAndUpdate(
      {
        _id: id,
        organization: req.user.organization,
      },
      {
        performaInvoiceNumber,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Performa Invoice not found" });
    }

    return res.json({
      message: "Performa Invoice number updated",
      performaInvoice: updated,
    });
  } catch (err) {
    console.error("Rename PI error:", err);
    return res.status(500).json({
      message: "Failed to update performa invoice number",
      error: err.message,
    });
  }
};

const sendPerformaInvoiceEmail = async (req, res) => {
  try {
    const nodemailer = require("nodemailer");
    const pi = await PerformaInvoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({ path: "deal", populate: ["contact", "company"] })
      .populate("items.itemId");

    if (!pi) {
      return res.status(404).json({ error: "Proforma invoice not found" });
    }

    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const orgDetails = await Branding.findOne({ organization: req.user.organization }).sort({ updatedAt: -1 });
    const pdfBuffer = await htmlDocumentPdf(pi, bankDetails, orgDetails, "performa");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const recipient = req.body.email || pi.deal?.email;
    if (!recipient) {
      return res.status(400).json({ error: "No recipient email address available" });
    }

    const subject = req.body.subject || `Proforma Invoice ${pi.performaInvoiceNumber}`;
    const body = req.body.body || `Dear ${pi.deal?.contactPerson || "Customer"},\n\nPlease find attached your proforma invoice.\n\nBest regards`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipient,
      subject,
      text: body,
      attachments: [
        {
          filename: `ProformaInvoice-${pi.performaInvoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    pi.status = "Sent";
    await pi.save();

    res.json({ message: "Proforma invoice emailed successfully" });
  } catch (error) {
    res.status(500).json({ error: `Failed to send proforma invoice email: ${error.message}` });
  }
};

const bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) {
      return res.status(400).json({ error: "ids and status are required" });
    }
    await PerformaInvoice.updateMany(
      { _id: { $in: ids }, organization: req.user.organization },
      { status }
    );
    res.json({ message: `Updated ${ids.length} proforma invoices to status: ${status}` });
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
    const docs = await PerformaInvoice.find({ _id: { $in: ids }, organization: req.user.organization }, '_id');
    const validIds = docs.map(d => d._id.toString());
    const failedIds = ids.filter(id => !validIds.includes(id));
    if (validIds.length > 0) {
      await PerformaInvoice.updateMany(
        { _id: { $in: validIds } },
        { signature: signature || "", signatureType: signatureType || "text" }
      );
    }
    res.json({ message: `Updated signature for ${validIds.length} proforma invoices`, successfulIds: validIds, failedIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPerformaInvoice,
  getAllPerformaInvoices,
  getAllPerformaInvoicesPaginated,
  getMyPerformaInvoices,
  downloadPerformaInvoice,
  deletePerformaInvoice,
  updatePerformaInvoice,
  updateStatus,
  updatePerformaInvoiceNumber,
  bulkUpdateStatus,
  bulkUpdateSignature,
  sendPerformaInvoiceEmail,
};
