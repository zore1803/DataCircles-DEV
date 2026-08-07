const NotificationSettings = require("../models/NotificationSettings");
const Notification = require("../models/Notification");

// --- Activity feed (auto-generated create/update/delete notifications) -------

// List recent notifications for the current user's organization, newest first,
// each flagged with whether the current user has read it.
exports.getFeed = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const userId = req.user._id;

    const notifications = await Notification.find({
      organization: req.user.organization,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const items = notifications.map((n) => ({
      ...n,
      read: (n.readBy || []).some((id) => String(id) === String(userId)),
    }));

    const unreadCount = items.filter((n) => !n.read).length;

    res.json({ items, unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Count of notifications the current user hasn't read yet.
exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      organization: req.user.organization,
      readBy: { $ne: req.user._id },
    });
    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark a single notification read for the current user.
exports.markRead = async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, organization: req.user.organization },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Clear (delete) all notifications for the organization.
exports.clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({ organization: req.user.organization });
    res.json({ message: "Notifications cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark every notification in the org read for the current user.
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { organization: req.user.organization, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ message: "All marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get current user's notification settings (within their organization)
exports.getMySettings = async (req, res) => {
  try {
    const settings = await NotificationSettings.findOne({
      organization: req.user.organization,
      userId: req.user._id
    });

    if (!settings) {
      // Create default settings if none exist
      const newSettings = await NotificationSettings.create({
        organization: req.user.organization,
        userId: req.user._id
      });
      return res.json(newSettings);
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update current user's notification settings
exports.updateMySettings = async (req, res) => {
  try {
    const { tasks, meetings, deals, dealTransitions } = req.body;

    const settings = await NotificationSettings.findOneAndUpdate(
      {
        organization: req.user.organization,
        userId: req.user._id
      },
      { tasks, meetings, deals, dealTransitions },
      { new: true, upsert: true }
    );

    res.json({ message: "Settings updated successfully", settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Get settings of a specific user in an organization
exports.getUserSettings = async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    const settings = await NotificationSettings.findOne({
      organization: orgId,
      userId
    });

    if (!settings) {
      return res.status(404).json({ error: "Notification settings not found" });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Update settings of a specific user in an organization
exports.updateUserSettings = async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const { tasks, meetings, deals, dealTransitions } = req.body;

    const settings = await NotificationSettings.findOneAndUpdate(
      { organization: orgId, userId },
      { tasks, meetings, deals, dealTransitions },
      { new: true, upsert: true }
    );

    res.json({ message: "User settings updated successfully", settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
