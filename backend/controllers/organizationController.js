const Organization = require('../models/Organization');
const crypto = require("crypto");

// These all take an :id param, but the only organization a caller should
// ever be able to read or mutate this way is their own — otherwise any
// authenticated user from Org A could pass Org B's _id and hijack Org B's
// join/invite code.
const assertOwnOrg = (req, res) => {
  if (req.params.id !== req.user.organization?.toString()) {
    res.status(403).json({ error: "You can only manage your own organization's code" });
    return false;
  }
  return true;
};

// GET organization code
exports.getOrganizationCode = async (req, res) => {
  try {
    if (!assertOwnOrg(req, res)) return;
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
    if (!assertOwnOrg(req, res)) return;
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
    if (!assertOwnOrg(req, res)) return;
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
