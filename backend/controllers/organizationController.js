const Organization = require('../models/Organization');
const crypto = require("crypto");

// GET organization code
exports.getOrganizationCode = async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json({ code: org.code });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// UPDATE organization code (manual update)
exports.updateOrganizationCode = async (req, res) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { code: req.body.code },
      { new: true }
    );
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json({ code: org.code });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// RESET organization code (auto-generate new one)
exports.resetOrganizationCode = async (req, res) => {
  try {
    const newCode = crypto.randomBytes(4).toString("hex"); // 8-char hex
    const org = await Organization.findByIdAndUpdate(
      req.params.id,
      { code: newCode },
      { new: true }
    );
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json({ code: org.code });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
