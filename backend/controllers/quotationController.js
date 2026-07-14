const Quotation = require("../models/quotation");
const BankDetails = require("../models/BankDetails");
const Branding = require("../models/Branding");
const generatePdf = require("../utils/generatePdf");
const modernPdf = require("../utils/modernPdf");
const minimalPdf = require("../utils/minimalPdf");
const ElegantPdf = require("../utils/ElegantPdf");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

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
      style,
      isTaxQuotation,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
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

    // Generate unique quotation number
    const extractNumber = (number) => {
      const match = number?.match(/^QUO-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    const quotations = await Quotation.find({
      organization: req.user.organization,
      quotationNumber: { $regex: /^QUO-\d+$/ },
    })
      .select("quotationNumber")
      .session(session);
    let maxNumber = 0;
    quotations.forEach((q) => {
      const num = extractNumber(q.quotationNumber);
      if (num > maxNumber) maxNumber = num;
    });
    const quotationNumber = `QUO-${maxNumber + 1}`;

    const quotation = new Quotation({
      deal,
      quotationNumber,
      date,
      dueDate,
      amount,
      status,
      items,
      style: style || "Classic",
      isTaxQuotation: isTaxQuotation || false,
      signature,
      signatureType: signatureType || "text",
      discount,
      receiverGSTIN,
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
    if (search) {
      query.$or = [
        { status: { $regex: search, $options: "i" } },
        { quotationNumber: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
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
    if (search) {
      query.$or = [
        { quotationNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
        { receiverGSTIN: { $regex: search, $options: "i" } },
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

    const bankDetails = await BankDetails.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    let pdfBuffer;
    switch (quotation.style) {
      case "Classic":
        pdfBuffer = await generatePdf(quotation, bankDetails, orgDetails);
        break;
      case "Modern":
        pdfBuffer = await modernPdf(quotation, bankDetails, orgDetails);
        break;
      case "Minimal":
        pdfBuffer = await minimalPdf(quotation, bankDetails, orgDetails);
        break;
      case "Elegant":
        pdfBuffer = await ElegantPdf(quotation, bankDetails, orgDetails);
        break;
      default:
        pdfBuffer = await generatePdf(quotation, bankDetails, orgDetails);
    }

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
      style,
      isTaxQuotation,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
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

    const quotation = await Quotation.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      {
        deal,
        date,
        dueDate,
        amount,
        status,
        items,
        style,
        isTaxQuotation,
        signature,
        signatureType,
        discount,
        receiverGSTIN,
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

    const bankDetails = await BankDetails.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    let pdfBuffer;
    switch (quotation.style) {
      case "Classic":
        pdfBuffer = await generatePdf(quotation, bankDetails, orgDetails);
        break;
      case "Modern":
        pdfBuffer = await modernPdf(quotation, bankDetails, orgDetails);
        break;
      case "Minimal":
        pdfBuffer = await minimalPdf(quotation, bankDetails, orgDetails);
        break;
      case "Elegant":
        pdfBuffer = await ElegantPdf(quotation, bankDetails, orgDetails);
        break;
      default:
        pdfBuffer = await generatePdf(quotation, bankDetails, orgDetails);
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
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

    await transporter.sendMail(mailOptions);
    quotation.status = "Sent";
    await quotation.save();

    res.json({ message: "Quotation emailed successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ error: `Failed to send quotation email: ${error.message}` });
  }
};

// Update Quotation Number
exports.updateQuotationNumber = async (req, res) => {
  try {
    const { quotationNumber } = req.body;
    const quotationId = req.params.id;

    if (
      !quotationNumber ||
      typeof quotationNumber !== "string" ||
      quotationNumber.trim() === ""
    ) {
      return res.status(400).json({ error: "quotationNumber is required" });
    }

    const normalized = quotationNumber.trim();

    const existing = await Quotation.findOne({
      quotationNumber: normalized,
      organization: req.user.organization,
      _id: { $ne: quotationId },
    });

    if (existing) {
      return res.status(409).json({ error: "Quotation number already exists" });
    }

    const updated = await Quotation.findOneAndUpdate(
      { _id: quotationId, organization: req.user.organization },
      { quotationNumber: normalized },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    res.json({ message: "Quotation number updated", quotation: updated });
  } catch (err) {
    console.error("updateQuotationNumber error:", err);
    res.status(500).json({ error: err.message });
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
