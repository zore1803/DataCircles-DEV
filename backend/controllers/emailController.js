// controllers/emailController.js
const EmailLog = require("../models/EmailLog");
const Company = require("../models/Company");
const Contact = require("../models/Contact");
const Vendor = require("../models/Vendor");
const sendMail = require("../utils/sendMail"); // Import your existing sendMail utility

const sendEmail = async (req, res) => {
  try {
    const { recipientType, recipientId, subject, body, fromEmail } = req.body;

    if (!['company', 'contact', 'vendor'].includes(recipientType)) {
      return res.status(400).json({ error: "Invalid recipient type" });
    }

    // Fetch recipient email based on type
    let recipientModel;
    let toEmail;
    switch (recipientType) {
      case 'company':
        recipientModel = await Company.findOne({ _id: recipientId, organization: req.user.organization });
        break;
      case 'contact':
        recipientModel = await Contact.findOne({ _id: recipientId, organization: req.user.organization });
        break;
      case 'vendor':
        recipientModel = await Vendor.findOne({ _id: recipientId, organization: req.user.organization });
        break;
    }

    if (!recipientModel) {
      return res.status(404).json({ error: `${recipientType.charAt(0).toUpperCase() + recipientType.slice(1)} not found` });
    }

    toEmail = recipientModel.email;
    if (!toEmail) {
      return res.status(400).json({ error: "Recipient email not found" });
    }

    // Send email using your existing sendMail function
    let response;
    let status = 'sent';
    const finalFromEmail = fromEmail || process.env.MAIL_USER;

    try {
      response = await sendMail({
        from:fromEmail,
        to: toEmail,
        subject,
        html: body, // HTML body
        text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      });
    } catch (sendError) {
      console.log(sendError);
      status = 'failed';
      response = { error: sendError.message };
    }

    // Create log
    const logData = {
      subject,
      body,
      toEmail,
      fromEmail: finalFromEmail,
      status,
      response,
      recipientType,
      [recipientType]: recipientId,
      user: req.user._id,
      organization: req.user.organization,
    };

    const newLog = new EmailLog(logData);
    await newLog.save();

    if (status === 'failed') {
      return res.status(500).json({ error: "Failed to send email", log: newLog });
    }

    res.status(200).json({ message: "Email sent successfully", log: newLog });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Keep all other functions unchanged
const getAllEmailLogs = async (req, res) => {
  try {
    const { search, recipientType, status } = req.query;
    let query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { toEmail: { $regex: search, $options: "i" } },
        { fromEmail: { $regex: search, $options: "i" } },
      ];
    }

    if (recipientType) {
      query.recipientType = recipientType;
    }

    if (status) {
      query.status = status;
    }

    const logs = await EmailLog.find(query)
      .populate('company contact vendor user')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllEmailLogsPaginated = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const { search, recipientType, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = { organization: req.user.organization };

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: "i" } },
        { toEmail: { $regex: search, $options: "i" } },
        { fromEmail: { $regex: search, $options: "i" } },
      ];
    }

    if (recipientType) {
      query.recipientType = recipientType;
    }

    if (status) {
      query.status = status;
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [logs, totalCount] = await Promise.all([
      EmailLog.find(query)
        .populate('company contact vendor user')
        .skip(skip)
        .limit(limit)
        .sort(sortObj)
        .lean()
        .select("-__v -body"),
      EmailLog.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      logs,
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
    console.error("Error fetching email logs:", error);
    res.status(500).json({
      error: "Failed to fetch email logs",
      message: error.message,
    });
  }
};

const getEmailLogById = async (req, res) => {
  try {
    const log = await EmailLog.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    }).populate('company contact vendor user');

    if (!log) {
      return res.status(404).json({ error: "Email log not found" });
    }

    res.json(log);
  } catch (err) {
    res.status(404).json({ error: "Email log not found" });
  }
};

const getEmailLogsByRecipient = async (req, res) => {
  try {
    const { type, id } = req.params;

    if (!['company', 'contact', 'vendor'].includes(type)) {
      return res.status(400).json({ error: "Invalid recipient type" });
    }

    const query = {
      recipientType: type,
      [type]: id,
      organization: req.user.organization,
    };

    const logs = await EmailLog.find(query)
      .populate('company contact vendor user')
      .sort({ createdAt: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  sendEmail,
  getAllEmailLogs,
  getAllEmailLogsPaginated,
  getEmailLogById,
  getEmailLogsByRecipient
};
