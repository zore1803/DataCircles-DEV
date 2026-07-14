const PerformaInvoice = require("../models/ProformaInvoice");
const BankDetails = require("../models/BankDetails");
const generatePdf = require("../utils/generatePdf");
const modernPdf = require("../utils/modernPdf");
const minimalPdf = require("../utils/minimalPdf");
const ElegantPdf = require("../utils/ElegantPdf");
const mongoose = require("mongoose");
const Branding = require("../models/Branding");

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
      isTaxInvoice,
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

    // ✅ Extract numeric part from PI-XXX format
    const extractPINumber = (piNumber) => {
      const match = piNumber?.match(/^PI-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    // ✅ Get all proforma invoices and extract the highest PI number
    const proformaInvoices = await PerformaInvoice.find({
      organization: req.user.organization,
      performaInvoiceNumber: { $regex: /^PI-\d+$/ },
    })
      .select("performaInvoiceNumber")
      .session(session);

    // ✅ Find the maximum PI number
    let maxPINumber = 0;
    proformaInvoices.forEach((pi) => {
      const piNumber = extractPINumber(pi.performaInvoiceNumber);
      if (piNumber > maxPINumber) {
        maxPINumber = piNumber;
      }
    });

    // ✅ Generate new unique proforma invoice number
    const performaInvoiceNumber = `PI-${maxPINumber + 1}`;

    const performaInvoice = new PerformaInvoice({
      deal,
      date,
      dueDate,
      amount,
      status,
      items,
      style: style || "Classic",
      isTaxInvoice: isTaxInvoice || false,
      signature,
      signatureType: signatureType || "text",
      discount: discount || { type: "fixed", value: 0 },
      receiverGSTIN,
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
      query.$or = [
        { status: { $regex: search, $options: "i" } },
        { performaInvoiceNumber: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
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
      query.$or = [
        { performaInvoiceNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
        { receiverGSTIN: { $regex: search, $options: "i" } }, // Added receiverGSTIN to search
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
    const bankDetails = await BankDetails.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    const OrgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    let pdfBuffer;

    switch (performaInvoice.style) {
      case "Classic":
        pdfBuffer = await generatePdf(performaInvoice, bankDetails, OrgDetails);
        break;
      case "Modern":
        pdfBuffer = await modernPdf(performaInvoice, bankDetails, OrgDetails);
        break;
      case "Minimal":
        pdfBuffer = await minimalPdf(performaInvoice, bankDetails, OrgDetails);
        break;
      case "Elegant":
        pdfBuffer = await ElegantPdf(performaInvoice, bankDetails, OrgDetails);
        break;
      default:
        pdfBuffer = await generatePdf(performaInvoice, bankDetails, OrgDetails);
    }

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
      isTaxInvoice,
      signature,
      signatureType,
      discount,
      receiverGSTIN,
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
        isTaxInvoice,
        signature,
        signatureType,
        discount,
        receiverGSTIN, // Added receiverGSTIN
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
};
