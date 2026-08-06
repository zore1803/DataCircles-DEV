const DocumentFooterTemplate = require('../models/DocumentFooterTemplate');

const KINDS = ['notes', 'terms'];
const DOC_TYPES = ['tax', 'performa', 'quotation', 'deliveryChallan'];

const isKind = (v) => KINDS.includes(v);
const isDocType = (v) => DOC_TYPES.includes(v);

/*
 * Only one template per (organization, kind, docType) may carry isDefault.
 * Clearing the siblings first keeps that true no matter which path set it.
 */
async function clearOtherDefaults(organization, kind, docType, keepId) {
  await DocumentFooterTemplate.updateMany(
    {
      organization,
      kind,
      docType,
      isDefault: true,
      ...(keepId ? { _id: { $ne: keepId } } : {}),
    },
    { $set: { isDefault: false } }
  );
}

exports.listTemplates = async (req, res) => {
  try {
    const { kind, docType } = req.query;
    const query = { organization: req.user.organization };
    if (kind) {
      if (!isKind(kind)) return res.status(400).json({ error: `Invalid kind "${kind}"` });
      query.kind = kind;
    }
    if (docType) {
      if (!isDocType(docType)) return res.status(400).json({ error: `Invalid docType "${docType}"` });
      query.docType = docType;
    }
    const templates = await DocumentFooterTemplate.find(query)
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean();
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: `Failed to load templates: ${error.message}` });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { kind, docType, title, body, isDefault, isActive } = req.body || {};
    if (!isKind(kind)) return res.status(400).json({ error: 'kind must be "notes" or "terms"' });
    if (!isDocType(docType)) return res.status(400).json({ error: `docType must be one of ${DOC_TYPES.join(', ')}` });

    // The first template of a given kind+type is the default automatically —
    // otherwise a freshly created set would have nothing to fall back on.
    const existingCount = await DocumentFooterTemplate.countDocuments({
      organization: req.user.organization,
      kind,
      docType,
    });
    const shouldDefault = isDefault === true || existingCount === 0;

    const template = await DocumentFooterTemplate.create({
      organization: req.user.organization,
      kind,
      docType,
      title: (title || '').toString().trim(),
      body: (body || '').toString(),
      isDefault: shouldDefault,
      isActive: isActive !== false,
    });

    if (shouldDefault) {
      await clearOtherDefaults(req.user.organization, kind, docType, template._id);
    }

    res.status(201).json({ template });
  } catch (error) {
    res.status(500).json({ error: `Failed to create template: ${error.message}` });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const template = await DocumentFooterTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const { title, body, isDefault, isActive } = req.body || {};
    if (title !== undefined) template.title = (title || '').toString().trim();
    if (body !== undefined) template.body = (body || '').toString();
    if (isActive !== undefined) template.isActive = !!isActive;

    if (isDefault === true) {
      // Deactivating and defaulting at once would leave the default unusable.
      template.isActive = true;
      template.isDefault = true;
    } else if (isDefault === false) {
      template.isDefault = false;
    }

    await template.save();
    if (template.isDefault) {
      await clearOtherDefaults(
        req.user.organization,
        template.kind,
        template.docType,
        template._id
      );
    }

    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: `Failed to update template: ${error.message}` });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const template = await DocumentFooterTemplate.findOneAndDelete({
      _id: req.params.id,
      organization: req.user.organization,
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Removing the default leaves the set without one; promote the most
    // recently updated active sibling so the group still has a fallback.
    if (template.isDefault) {
      const next = await DocumentFooterTemplate.findOne({
        organization: req.user.organization,
        kind: template.kind,
        docType: template.docType,
        isActive: true,
      }).sort({ updatedAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete template: ${error.message}` });
  }
};
