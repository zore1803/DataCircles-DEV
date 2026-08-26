const DocumentTemplateSettings = require("../models/DocumentTemplateSettings");

const TEMPLATES = [
  "Classic",
  "Modern",
  "Minimal",
  "Elegant",
  "Compact",
  "Corporate",
  "Vibrant",
  "Mono",
];
const DOC_TYPES = ["tax", "performa", "quotation", "deliveryChallan", "salesReturn"];

const DEFAULTS = {
  tax: "Classic",
  performa: "Classic",
  quotation: "Classic",
  deliveryChallan: "Classic",
  salesReturn: "Classic",
};

/*
 * Reads the organization's template choices, falling back to the defaults when
 * nothing has been saved yet. Shared with the PDF generators so a document
 * without its own explicit style still renders with the chosen template.
 */
async function getTemplatesForOrg(organization) {
  const settings = await DocumentTemplateSettings.findOne({ organization }).lean();
  return { ...DEFAULTS, ...(settings?.templates || {}) };
}

exports.getTemplatesForOrg = getTemplatesForOrg;

exports.getDocumentTemplates = async (req, res) => {
  try {
    const templates = await getTemplatesForOrg(req.user.organization);
    res.json({ templates, available: TEMPLATES });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to load document settings: ${err.message}` });
  }
};

exports.updateDocumentTemplates = async (req, res) => {
  try {
    const { templates } = req.body || {};
    if (!templates || typeof templates !== "object") {
      return res.status(400).json({ error: "templates object is required" });
    }

    // Only accept known document types with known template names, so a bad
    // payload can't persist a value the renderer doesn't understand.
    const update = {};
    for (const type of DOC_TYPES) {
      const value = templates[type];
      if (value === undefined) continue;
      if (!TEMPLATES.includes(value)) {
        return res
          .status(400)
          .json({ error: `Invalid template "${value}" for ${type}` });
      }
      update[`templates.${type}`] = value;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid template values supplied" });
    }

    const settings = await DocumentTemplateSettings.findOneAndUpdate(
      { organization: req.user.organization },
      { $set: update, $setOnInsert: { organization: req.user.organization } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      templates: { ...DEFAULTS, ...(settings?.templates || {}) },
      available: TEMPLATES,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to save document settings: ${err.message}` });
  }
};
