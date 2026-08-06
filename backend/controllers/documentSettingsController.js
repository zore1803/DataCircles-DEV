const DocumentSettings = require('../models/DocumentSettings');
const { normalizeInvoiceNumberSettings, saveDocumentSettingsForOrganization } = require('../utils/documentNumbering');

exports.getDocumentSettings = async (req, res) => {
  try {
    const settings = await DocumentSettings.findOne({ organization: req.user.organization }).lean();
    res.json(normalizeInvoiceNumberSettings(settings || {}));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateDocumentSettings = async (req, res) => {
  try {
    const { invoicePrefix, invoiceSuffix, nextInvoiceNumber, documentTypeSettings, invoicePrefixes, invoiceSuffixes, defaultNotes, defaultTerms, defaultNotesByType, defaultTermsByType } = req.body || {};
    const saved = await saveDocumentSettingsForOrganization(req.user.organization, {
      invoicePrefix,
      invoiceSuffix,
      nextInvoiceNumber,
      documentTypeSettings,
      invoicePrefixes,
      invoiceSuffixes,
      defaultNotes,
      defaultTerms,
      defaultNotesByType,
      defaultTermsByType,
    });

    res.json({
      message: 'Document settings updated successfully',
      settings: normalizeInvoiceNumberSettings(saved),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
