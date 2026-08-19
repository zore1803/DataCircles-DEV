const Quotation = require("../models/quotation");
const getDefaultBankDetails = require("../utils/getDefaultBankDetails");
const Branding = require("../models/Branding");
const htmlDocumentPdf = require("../utils/htmlDocumentPdf");
const sendGridMail = require("../utils/sendGridMail");
const mongoose = require("mongoose");
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

// Create Quotation
exports.createQuotation = async (req, res) => {
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
      isTaxQuotation,
      transactionType,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
      quotationPrefix,
      quotationSuffix,
      quotationNumber: clientQuotationNumber,
      reference,
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

    // Quotation number: Document Settings' configured prefix
    // (documentTypeSettings.quote.prefix) is the source of truth when the
    // client doesn't send one — previously this fell back to a hardcoded
    // "QUO-" that never matched what Settings actually said. Numbering is
    // scoped to the resolved prefix specifically, so switching prefixes
    // restarts (or resumes) cleanly instead of continuing another prefix's
    // sequence.
    const documentSettings = await getDocumentSettingsForOrganization(req.user.organization);
    const finalPrefix = (quotationPrefix && quotationPrefix.trim()) || documentSettings.documentTypeSettings?.quote?.prefix || "QT-";
    const finalSuffix = (quotationSuffix ?? documentSettings.documentTypeSettings?.quote?.suffix ?? "").toString().trim();
    let quotationNumber;
    try {
      quotationNumber = await resolveDocumentNumber({
        Model: Quotation,
        numberField: "quotationNumber",
        organization: req.user.organization,
        documentTypeKey: "quote",
        prefix: finalPrefix,
        suffix: finalSuffix,
        providedNumber: clientQuotationNumber && String(clientQuotationNumber).trim() ? clientQuotationNumber : null,
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

    const quotation = new Quotation({
      deal,
      quotationPrefix: finalPrefix,
      quotationNumber,
      reference: reference || "",
      date,
      dueDate,
      amount,
      status,
      items,
      notes: notes || "",
      terms: terms || "",
      isTaxQuotation: isTaxQuotation || false,
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

    await quotation.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(quotation);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({ error: `Failed to create quotation: ${err.message}` });
  }
};

// Get All Quotations
exports.getAllQuotations = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };

    if (req.ownOnly) {
      query.user = req.user._id;
    }

    if (search) {
      const matchingDeals = await Deal.find(
        { organization: req.user.organization, title: { $regex: search, $options: "i" } },
        { _id: 1 }
      );
      query.$or = [
        { status: { $regex: search, $options: "i" } },
        { quotationNumber: { $regex: search, $options: "i" } },
        { deal: { $in: matchingDeals.map((d) => d._id) } },
        { receiverGSTIN: { $regex: search, $options: "i" } },
      ];
    }

    const quotations = await Quotation.find(query).populate("deal");
    res.json(quotations);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to fetch quotations: ${error.message}` });
  }
};

// Get All Quotations Paginated
exports.getAllQuotationsPaginated = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;
    const {
      search,
      status,
      sortBy = "quotationNumber",
      sortOrder = "asc",
    } = req.query;

    const query = { organization: req.user.organization };

    if (req.ownOnly) {
      query.user = req.user._id;
    }

    if (search) {
      const matchingDeals = await Deal.find(
        { organization: req.user.organization, title: { $regex: search, $options: "i" } },
        { _id: 1 }
      );
      query.$or = [
        { quotationNumber: { $regex: search, $options: "i" } },
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

    const [quotations, totalCount] = await Promise.all([
      Quotation.find(query)
        .populate("deal")
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      Quotation.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      quotations,
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
    res
      .status(500)
      .json({ error: `Failed to fetch quotations: ${error.message}` });
  }
};

// Download Quotation
exports.downloadQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({
        path: "deal",
        populate: ["contact", "company"],
      })
      .populate("items.itemId");

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    // The template is resolved from the organization's document settings
    // inside htmlDocumentPdf, which renders the same markup as the live preview.
    const copyType = ["original", "duplicate", "triplicate"].includes(req.query.copyType)
      ? req.query.copyType
      : "original";
    const pdfBuffer = await htmlDocumentPdf(quotation, bankDetails, orgDetails, "quotation", copyType);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=quotation-${quotation.quotationNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to download quotation: ${err.message}` });
  }
};

// Delete Quotation
exports.deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    await quotation.deleteOne();
    res.json({ message: "Quotation deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to delete quotation: ${err.message}` });
  }
};

// Update Quotation
exports.updateQuotation = async (req, res) => {
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
      isTaxQuotation,
      transactionType,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
      billingAddress,
      shippingAddress,
      reference,
    } = req.body;

    const requiredFields = ["deal", "date", "amount", "status", "discount"];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res
          .status(400)
          .json({ error: `Missing required field: ${field}` });
      }
    }

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

    const quotation = await Quotation.findOneAndUpdate(
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
        notes,
        terms,
        isTaxQuotation,
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

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    res.json({ message: "Quotation updated successfully", quotation });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to update quotation: ${err.message}` });
  }
};

// Update Quotation Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const quotation = await Quotation.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status },
      { new: true }
    );

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    res.json({ message: "Quotation status updated successfully", quotation });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to update quotation status: ${err.message}` });
  }
};

// Send Quotation Email
exports.sendQuotationEmail = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({
        path: "deal",
        populate: ["contact", "company"],
      })
      .populate("items.itemId");

    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const bankDetails = await getDefaultBankDetails(req.user.organization);
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    // The template is resolved from the organization's document settings
    // inside htmlDocumentPdf, which renders the same markup as the live preview.
    const pdfBuffer = await htmlDocumentPdf(quotation, bankDetails, orgDetails, "quotation");

    const mailOptions = {
      to: quotation.deal.email || req.body.email,
      subject: `Quotation ${quotation.quotationNumber}`,
      text: `Dear ${
        quotation.deal.contactPerson || "Customer"
      },\n\nPlease find attached the quotation.\n\nBest regards,\nYour Company`,
      attachments: [
        {
          filename: `Quotation-${quotation.quotationNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    await sendGridMail(mailOptions);
    quotation.status = "Sent";
    await quotation.save();

    res.json({ message: "Quotation emailed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: `Failed to send quotation email: ${error.message}` });
  }
};

// Update Quotation Number (Rename QUO-XXX)
exports.updateQuotationNumber = async (req, res) => {
  try {
    const { quotationNumber } = req.body;
    const quotationId = req.params.id;

    // Validate input
    if (
      !quotationNumber ||
      typeof quotationNumber !== "string" ||
      quotationNumber.trim() === ""
    ) {
      return res.status(400).json({ error: "quotationNumber is required" });
    }

    const newNumber = quotationNumber.trim().toUpperCase();

    // Prevent duplicates inside same organization
    const existing = await Quotation.findOne({
      quotationNumber: newNumber,
      organization: req.user.organization,
      _id: { $ne: quotationId },
    });

    if (existing) {
      return res.status(409).json({ error: "Quotation number already exists" });
    }

    // Update
    const updatedQuotation = await Quotation.findOneAndUpdate(
      {
        _id: quotationId,
        organization: req.user.organization,
      },
      { quotationNumber: newNumber },
      { new: true }
    );

    if (!updatedQuotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    return res.json({
      message: "Quotation number updated successfully",
      quotation: updatedQuotation,
    });
  } catch (err) {
    console.error("updateQuotationNumber error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!ids || !ids.length || !status) {
      return res.status(400).json({ error: "ids and status are required" });
    }
    await Quotation.updateMany(
      { _id: { $in: ids }, organization: req.user.organization },
      { status }
    );
    res.json({ message: `Updated ${ids.length} quotations to status: ${status}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.bulkUpdateSignature = async (req, res) => {
  try {
    const { ids, signature, signatureType } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ error: "ids are required" });
    }
    const quotations = await Quotation.find({ _id: { $in: ids }, organization: req.user.organization }, '_id');
    const validIds = quotations.map(q => q._id.toString());
    const failedIds = ids.filter(id => !validIds.includes(id));
    
    if (validIds.length > 0) {
      await Quotation.updateMany(
        { _id: { $in: validIds } },
        { signature: signature || "", signatureType: signatureType || "text" }
      );
    }
    
    res.json({
      message: `Updated signature for ${validIds.length} quotations`,
      successfulIds: validIds,
      failedIds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
