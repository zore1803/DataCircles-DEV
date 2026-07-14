const EmailTemplate = require("../models/EmailTemplate");

// CREATE
exports.createTemplate = async (req, res) => {
  try {
    const { name, subject, body, type, dealTransition } = req.body;

    const template = await EmailTemplate.create({
      organization: req.user.organization,
      name,
      subject,
      body,
      type,
      dealTransition,
      createdBy: req.user._id
    });

    res.status(201).json({ message: "Template created successfully", template });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// READ - Get all templates for current org
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await EmailTemplate.find({
      organization: req.user.organization
    }).sort({ createdAt: -1 });

    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// READ - Get a single template
exports.getTemplateById = async (req, res) => {
  try {
    const template = await EmailTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE
exports.updateTemplate = async (req, res) => {
  try {
    const { name, subject, body, type, dealTransition } = req.body;

    const updated = await EmailTemplate.findOneAndUpdate(
      { _id: req.params.id, organization: req.user.organization },
      { name, subject, body, type, dealTransition },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ message: "Template updated successfully", template: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE
exports.deleteTemplate = async (req, res) => {
  try {
    const deleted = await EmailTemplate.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization
    });

    if (!deleted) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
