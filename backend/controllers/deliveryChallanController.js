const DeliveryChallan = require("../models/deliveryChallan");
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

// Create Delivery Challan
exports.createDeliveryChallan = async (req, res) => {
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
      signature,
      signatureType,
      discount,
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

    // Generate unique delivery challan number
    const extractNumber = (number) => {
      const match = number?.match(/^DC-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    const deliveryChallans = await DeliveryChallan.find({
      organization: req.user.organization,
      deliveryChallanNumber: { $regex: /^DC-\d+$/ },
    })
      .select("deliveryChallanNumber")
      .session(session);
    let maxNumber = 0;
    deliveryChallans.forEach((dc) => {
      const num = extractNumber(dc.deliveryChallanNumber);
      if (num > maxNumber) maxNumber = num;
    });
    const deliveryChallanNumber = `DC-${maxNumber + 1}`;

    const deliveryChallan = new DeliveryChallan({
      deal,
      deliveryChallanNumber,
      date,
      dueDate,
      amount,
      status,
      items,
      style: style || "Classic",
      signature,
      signatureType: signatureType || "text",
      discount,
      user: req.user.id,
      organization: req.user.organization,
    });

    await deliveryChallan.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json(deliveryChallan);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({ error: `Failed to create delivery challan: ${err.message}` });
  }
};

// Get All Delivery Challans
exports.getAllDeliveryChallans = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { organization: req.user.organization };
    if (search) {
      query.$or = [
        { status: { $regex: search, $options: "i" } },
        { deliveryChallanNumber: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
      ];
    }

    const deliveryChallans = await DeliveryChallan.find(query).populate("deal");
    res.json(deliveryChallans);
  } catch (error) {
    res
      .status(500)
      .json({ message: `Failed to fetch delivery challans: ${error.message}` });
  }
};

// Get All Delivery Challans Paginated
exports.getAllDeliveryChallansPaginated = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;
    const {
      search,
      status,
      sortBy = "deliveryChallanNumber",
      sortOrder = "asc",
    } = req.query;

    const query = { organization: req.user.organization };
    if (search) {
      query.$or = [
        { deliveryChallanNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { "deal.title": { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;

    const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [deliveryChallans, totalCount] = await Promise.all([
      DeliveryChallan.find(query)
        .populate("deal")
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v"),
      DeliveryChallan.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      deliveryChallans,
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
      .json({ error: `Failed to fetch delivery challans: ${error.message}` });
  }
};

// Download Delivery Challan
exports.downloadDeliveryChallan = async (req, res) => {
  try {
    const deliveryChallan = await DeliveryChallan.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({
        path: "deal",
        populate: ["contact", "company"],
      })
      .populate("items.itemId");

    if (!deliveryChallan) {
      return res.status(404).json({ error: "Delivery Challan not found" });
    }

    const bankDetails = await BankDetails.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    let pdfBuffer;
    switch (deliveryChallan.style) {
      case "Classic":
        pdfBuffer = await generatePdf(deliveryChallan, bankDetails, orgDetails);
        break;
      case "Modern":
        pdfBuffer = await modernPdf(deliveryChallan, bankDetails, orgDetails);
        break;
      case "Minimal":
        pdfBuffer = await minimalPdf(deliveryChallan, bankDetails, orgDetails);
        break;
      case "Elegant":
        pdfBuffer = await ElegantPdf(deliveryChallan, bankDetails, orgDetails);
        break;
      default:
        pdfBuffer = await generatePdf(deliveryChallan, bankDetails, orgDetails);
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=delivery-challan-${deliveryChallan.deliveryChallanNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to download delivery challan: ${err.message}` });
  }
};

// Delete Delivery Challan
exports.deleteDeliveryChallan = async (req, res) => {
  try {
    const deliveryChallan = await DeliveryChallan.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!deliveryChallan) {
      return res.status(404).json({ error: "Delivery Challan not found" });
    }

    await deliveryChallan.deleteOne();
    res.json({ message: "Delivery Challan deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to delete delivery challan: ${err.message}` });
  }
};

// Update Delivery Challan
exports.updateDeliveryChallan = async (req, res) => {
  try {
    const {
      deal,
      date,
      dueDate,
      amount,
      status,
      items,
      style,
      signature,
      signatureType,
      discount,
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

    const deliveryChallan = await DeliveryChallan.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      {
        deal,
        date,
        dueDate,
        amount,
        status,
        items,
        style,
        signature,
        signatureType,
        discount,
      },
      { new: true }
    );

    if (!deliveryChallan) {
      return res.status(404).json({ error: "Delivery Challan not found" });
    }

    res.json({
      message: "Delivery Challan updated successfully",
      deliveryChallan,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to update delivery challan: ${err.message}` });
  }
};

// Update Delivery Challan Status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const deliveryChallan = await DeliveryChallan.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { status },
      { new: true }
    );

    if (!deliveryChallan) {
      return res.status(404).json({ error: "Delivery Challan not found" });
    }

    res.json({
      message: "Delivery Challan status updated successfully",
      deliveryChallan,
    });
  } catch (err) {
    res.status(500).json({
      error: `Failed to update delivery challan status: ${err.message}`,
    });
  }
};

// Send Delivery Challan Email
exports.sendDeliveryChallanEmail = async (req, res) => {
  try {
    const deliveryChallan = await DeliveryChallan.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    })
      .populate({
        path: "deal",
        populate: ["contact", "company"],
      })
      .populate("items.itemId");

    if (!deliveryChallan) {
      return res.status(404).json({ error: "Delivery Challan not found" });
    }

    const bankDetails = await BankDetails.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });
    const orgDetails = await Branding.findOne({
      organization: req.user.organization,
    }).sort({ updatedAt: -1 });

    let pdfBuffer;
    switch (deliveryChallan.style) {
      case "Classic":
        pdfBuffer = await generatePdf(deliveryChallan, bankDetails, orgDetails);
        break;
      case "Modern":
        pdfBuffer = await modernPdf(deliveryChallan, bankDetails, orgDetails);
        break;
      case "Minimal":
        pdfBuffer = await minimalPdf(deliveryChallan, bankDetails, orgDetails);
        break;
      case "Elegant":
        pdfBuffer = await ElegantPdf(deliveryChallan, bankDetails, orgDetails);
        break;
      default:
        pdfBuffer = await generatePdf(deliveryChallan, bankDetails, orgDetails);
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
      to: deliveryChallan.deal.email || req.body.email,
      subject: `Delivery Challan ${deliveryChallan.deliveryChallanNumber}`,
      text: `Dear ${
        deliveryChallan.deal.contactPerson || "Customer"
      },\n\nPlease find attached the delivery challan.\n\nBest regards,\nYour Company`,
      attachments: [
        {
          filename: `DeliveryChallan-${deliveryChallan.deliveryChallanNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    deliveryChallan.status = "Sent";
    await deliveryChallan.save();

    res.json({ message: "Delivery Challan emailed successfully" });
  } catch (error) {
    res.status(500).json({
      error: `Failed to send delivery challan email: ${error.message}`,
    });
  }
};
// Update ONLY Delivery Challan Number
exports.updateDeliveryChallanNumber = async (req, res) => {
  try {
    const { deliveryChallanNumber } = req.body;
    const id = req.params.id;

    if (!deliveryChallanNumber || typeof deliveryChallanNumber !== "string") {
      return res
        .status(400)
        .json({ error: "deliveryChallanNumber is required" });
    }

    const normalized = deliveryChallanNumber.trim();

    // Check duplicate
    const exists = await DeliveryChallan.findOne({
      deliveryChallanNumber: normalized,
      organization: req.user.organization,
      _id: { $ne: id },
    });

    if (exists) {
      return res
        .status(409)
        .json({ error: "Delivery Challan number already exists" });
    }

    const updated = await DeliveryChallan.findOneAndUpdate(
      { _id: id, organization: req.user.organization },
      { deliveryChallanNumber: normalized },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Delivery Challan not found" });
    }

    res.json({
      message: "Delivery Challan number updated successfully",
      deliveryChallan: updated,
    });
  } catch (err) {
    console.error("updateDeliveryChallanNumber error:", err);
    res.status(500).json({ error: err.message });
  }
};
