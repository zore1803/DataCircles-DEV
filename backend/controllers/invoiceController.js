const Invoice = require("../models/Invoice");
const Counter = require("../models/Counter");
const generatePdf = require("../utils/generatePdf");
const modernPdf = require("../utils/modernPdf");
const minimalPdf = require("../utils/minimalPdf");
const ElegantPdf = require("../utils/ElegantPdf");
const BankDetails = require("../models/BankDetails");
const Branding = require("../models/Branding");
const mongoose = require("mongoose");
const Deal = require("../models/Deal");

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
      isTaxInvoice,
      signature,
      signatureType,
      receiverGSTIN,
      transactionType,
      gstRate,
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

    // ✅ Extract numeric part from INV-XXX format
    const extractINVNumber = (invNumber) => {
      const match = invNumber?.match(/^INV-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };

    // ✅ Get all invoices and extract the highest INV number
    const invoices = await Invoice.find({
      organization: req.user.organization,
      invoiceNumber: { $regex: /^INV-\d+$/ },
    })
      .select("invoiceNumber")
      .session(session);

    // ✅ Find the maximum INV number
    let maxINVNumber = 0;
    invoices.forEach((inv) => {
      const invNumber = extractINVNumber(inv.invoiceNumber);
      if (invNumber > maxINVNumber) {
        maxINVNumber = invNumber;
      }
    });

    // ✅ Generate new unique invoice number
    const invoiceNumber = `INV-${maxINVNumber + 1}`;

    const invoice = new Invoice({
      deal,
      date,
      dueDate,
      amount,
      discount,
      status,
      items,
      style,
      isTaxInvoice,
      signature,
      signatureType,
      receiverGSTIN,
      transactionType: isTaxInvoice ? transactionType || "intra" : undefined,
      gstRate: isTaxInvoice ? gstRate || 18 : undefined,
      invoiceNumber,
      user: req.user.id,
      organization: req.user.organization,
    });

    await invoice.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json(invoice);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: err.message });
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
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
        { receiverGSTIN: { $regex: search, $options: "i" } }, // Added receiverGSTIN to search
        { transactionType: { $regex: search, $options: "i" } },
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
    const [invoices, totalCount] = await Promise.all([
      Invoice.find(query)
        .populate("deal")
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
    const bankDetails = await BankDetails.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    const OrgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    let pdfBuffer;

    switch (invoice.style) {
      case "Classic":
        pdfBuffer = await generatePdf(invoice, bankDetails, OrgDetails);
        break;
      case "Modern":
        pdfBuffer = await modernPdf(invoice, bankDetails, OrgDetails);
        break;
      case "Minimal":
        pdfBuffer = await minimalPdf(invoice, bankDetails, OrgDetails);
        break;
      case "Elegant":
        pdfBuffer = await ElegantPdf(invoice, bankDetails, OrgDetails);
        break;
      default:
        pdfBuffer = await generatePdf(invoice, bankDetails, OrgDetails);
    }

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
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    await invoice.deleteOne();
    res.json({
      message: "Invoice deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateInvoice = async (req, res) => {
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
      isTaxInvoice,
      signature,
      signatureType,
      receiverGSTIN,
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

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      {
        deal,
        date,
        dueDate,
        amount,
        discount,
        status,
        items,
        style,
        isTaxInvoice,
        signature,
        signatureType,
        receiverGSTIN, // Added receiverGSTIN
        transactionType: isTaxInvoice ? transactionType || "intra" : undefined,
        gstRate: isTaxInvoice ? gstRate || 18 : undefined,
      },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json({
      message: "Invoice updated successfully",
      invoice,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.user.organization,
      },
      { status },
      { new: true }
    );

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    res.json({
      message: "Invoice status updated successfully",
      invoice,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const invoices = await Invoice.find(filter).populate("deal user");

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createInvoice,
  getAllInvoices,
  getAllInvoicesPaginated,
  getMyInvoices,
  downloadInvoice,
  deleteInvoice,
  updateInvoice,
  updateStatus,
  getInvoicesByCompany,
  updateInvoiceNumber,
};
