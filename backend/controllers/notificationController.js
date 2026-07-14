const NotificationSettings = require("../models/NotificationSettings");

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
