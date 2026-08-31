// controllers/callLogController.js
const CallLog = require("../models/CallLog");
const Contact = require("../models/Contact");
const { getOwnedCompanyIds } = require("../utils/ownedCompanies");

// Mirrors contactController's isOwnedByUser: a call log is "owned" if this
// user is the one who logged it (`user` field — CallLog has no `createdBy`),
// or it belongs to a company this user has been made the OWNER of
// (Company.owner). `ownedCompanyIds` is optional — pass it (from
// getOwnedCompanyIds) when that broader check should apply.
const isOwnedByUser = (callLog, userId, ownedCompanyIds = []) => {
  const uid = userId.toString();
  const ownerUid = (callLog.user?._id ?? callLog.user)?.toString();
  if (ownerUid === uid) return true;

  const companyId = (callLog.company?._id ?? callLog.company)?.toString();
  return !!companyId && ownedCompanyIds.some((id) => id.toString() === companyId);
};

// There is no checkPermission("callLogs", ...) gate wired into callLogRoutes.js
// (see note there), so req.ownOnly is never set for call logs by middleware.
// This reads the user's permissions array directly and returns true only when
// they have an explicit "callLogs": "own-only" entry, so behavior for every
// other user (no entry, read-write, readonly) is unchanged from before.
const isCallLogOwnOnly = (user) => {
  if (!user || user.role === "admin") return false;
  const perm = user.permissions?.find(
    (p) => p.name?.toLowerCase() === "calllogs",
  )?.permission;
  return perm === "own-only";
};

// Create Call Log
exports.createCallLog = async (req, res) => {
  try {
    // Automatically add organization from authenticated user
    const callLogData = {
      ...req.body,
      organization: req.user.organization,
      user: req.user._id
    };

    // Company Profile's "New Call Log" already knows the company, but a call
    // logged from the Contact page doesn't send one — derive it from the
    // contact either way, so every call log is queryable by company
    // regardless of where it was created.
    if (!callLogData.company && callLogData.contact) {
      const contact = await Contact.findOne({
        _id: callLogData.contact,
        organization: req.user.organization,
      }).select("company");
      if (contact?.company) {
        callLogData.company = contact.company;
      }
    }

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

// Get Call Logs for a specific company within user's organization
exports.getCallLogsByCompany = async (req, res) => {
  try {
    const callLogs = await CallLog.find({
      company: req.params.companyId,
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

// Get All Call Logs for user's organization
exports.getCallLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = { organization: req.user.organization };

    if (isCallLogOwnOnly(req.user)) {
      const ownedCompanyIds = await getOwnedCompanyIds(req.user._id, req.user.organization);
      query.$or = [
        { user: req.user._id },
        { company: { $in: ownedCompanyIds } },
      ];
    }

    const callLogs = await CallLog.find(query)
      .populate("contact", "name email phone")
      .populate("user", "name email")
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CallLog.countDocuments(query);

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
    // No checkPermission gate exists for callLogs routes (see callLogRoutes.js),
    // so this only restricts users who have an explicit "callLogs": "own-only"
    // permission entry — everyone else's access is unchanged from before.
    if (isCallLogOwnOnly(req.user)) {
      const existing = await CallLog.findOne({ _id: req.params.id, organization: req.user.organization });
      if (!existing) return res.status(404).json({ error: "Call Log not found" });
      const ownedCompanyIds = await getOwnedCompanyIds(req.user._id, req.user.organization);
      if (!isOwnedByUser(existing, req.user._id, ownedCompanyIds)) {
        return res.status(403).json({ error: "You can only edit call logs you own" });
      }
    }

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
    const callLog = await CallLog.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!callLog) {
      return res.status(404).json({ error: "Call Log not found or access denied" });
    }

    if (isCallLogOwnOnly(req.user)) {
      const ownedCompanyIds = await getOwnedCompanyIds(req.user._id, req.user.organization);
      if (!isOwnedByUser(callLog, req.user._id, ownedCompanyIds)) {
        return res.status(403).json({ error: "You can only delete call logs you own" });
      }
    }

    await callLog.deleteOne();

    res.json({ message: "Call Log deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
