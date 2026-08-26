const Organization = require("../models/Organization");

const HANDLE_REGEX = /^[a-z0-9]{5,32}$/;

exports.getEmailHandle = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organization).select("emailHandle");
    res.json({ handle: org?.emailHandle || null });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch email handle" });
  }
};

exports.checkAvailability = async (req, res) => {
  try {
    const handle = String(req.query.handle || "").trim().toLowerCase();
    if (!HANDLE_REGEX.test(handle)) {
      return res.status(400).json({
        available: false,
        error: "Min 5 characters, letters and numbers only.",
      });
    }

    const existing = await Organization.findOne({ emailHandle: handle });
    const available = !existing || String(existing._id) === String(req.user.organization);
    res.json({ available });
  } catch (err) {
    res.status(500).json({ error: "Failed to check availability" });
  }
};

exports.claimHandle = async (req, res) => {
  try {
    const handle = String(req.body.handle || "").trim().toLowerCase();
    if (!HANDLE_REGEX.test(handle)) {
      return res.status(400).json({ error: "Min 5 characters, letters and numbers only." });
    }

    const existing = await Organization.findOne({ emailHandle: handle });
    if (existing && String(existing._id) !== String(req.user.organization)) {
      return res.status(409).json({ error: "This handle is already taken." });
    }

    const org = await Organization.findByIdAndUpdate(
      req.user.organization,
      { emailHandle: handle },
      { new: true },
    ).select("emailHandle");

    res.json({ handle: org.emailHandle });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This handle is already taken." });
    }
    res.status(500).json({ error: "Failed to claim handle" });
  }
};

exports.releaseHandle = async (req, res) => {
  try {
    await Organization.findByIdAndUpdate(req.user.organization, { $unset: { emailHandle: "" } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to release handle" });
  }
};
