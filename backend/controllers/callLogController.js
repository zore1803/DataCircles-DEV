// controllers/callLogController.js
const CallLog = require("../models/CallLog");

// Create Call Log
exports.createCallLog = async (req, res) => {
  try {
    // Automatically add organization from authenticated user
    const callLogData = {
      ...req.body,
      organization: req.user.organization,
      user: req.user._id
    };
    
    const callLog = await CallLog.create(callLogData);
    
    // Populate the response
    const populatedCallLog = await CallLog.findById(callLog._id)
      .populate("contact", "name email phone")
      .populate("user", "name email");
    
    res.status(201).json(populatedCallLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get All Call Logs for user's organization
exports.getCallLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const callLogs = await CallLog.find({ 
      organization: req.user.organization 
    })
      .populate("contact", "name email phone")
      .populate("user", "name email")
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await CallLog.countDocuments({ 
      organization: req.user.organization 
    });
    
    res.json({
      callLogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Call Logs for specific contact within user's organization
exports.getCallLogsByContact = async (req, res) => {
  try {
    const callLogs = await CallLog.find({ 
      contact: req.params.contactId,
      organization: req.user.organization 
    })
      .populate("contact", "name email phone")
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    
    res.json(callLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Call Logs by Organization (Admin only)
exports.getCallLogsByOrganization = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const callLogs = await CallLog.find({ 
      organization: req.params.orgId 
    })
      .populate("contact", "name email phone")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await CallLog.countDocuments({ 
      organization: req.params.orgId 
    });
    
    res.json({
      callLogs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Call Log (only within user's organization)
exports.updateCallLog = async (req, res) => {
  try {
    const callLog = await CallLog.findOneAndUpdate(
      { 
        _id: req.params.id,
        organization: req.user.organization 
      }, 
      req.body, 
      { new: true, runValidators: true }
    )
      .populate("contact", "name email phone")
      .populate("user", "name email");
    
    if (!callLog) {
      return res.status(404).json({ error: "Call Log not found or access denied" });
    }
    
    res.json(callLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete Call Log (only within user's organization)
exports.deleteCallLog = async (req, res) => {
  try {
    const callLog = await CallLog.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });
    
    if (!callLog) {
      return res.status(404).json({ error: "Call Log not found or access denied" });
    }
    
    res.json({ message: "Call Log deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
