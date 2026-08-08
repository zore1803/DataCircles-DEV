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

exports.getSignatures = async (req, res) => {
  try {
    const settings = await DocumentSettings.findOne({ organization: req.user.organization }).lean();
    res.json(settings?.signatures || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.saveSignature = async (req, res) => {
  try {
    const { id, name, type, dataUrl, isDefault } = req.body;
    if (!name || !type || !dataUrl) {
      return res.status(400).json({ error: 'Name, type, and signature image/data are required' });
    }

    let docSettings = await DocumentSettings.findOne({ organization: req.user.organization });
    if (!docSettings) {
      docSettings = new DocumentSettings({ organization: req.user.organization, signatures: [] });
    }

    const newSig = {
      id: id || Date.now().toString(),
      name,
      type,
      dataUrl,
      isDefault: Boolean(isDefault) || docSettings.signatures.length === 0,
      createdAt: new Date(),
    };

    if (newSig.isDefault) {
      docSettings.signatures.forEach((sig) => {
        sig.isDefault = false;
      });
    }

    docSettings.signatures.push(newSig);
    await docSettings.save();

    res.status(201).json({ message: 'Signature saved successfully', signature: newSig, signatures: docSettings.signatures });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const docSettings = await DocumentSettings.findOne({ organization: req.user.organization });
    if (!docSettings) {
      return res.status(444).json({ error: 'Document settings not found' });
    }

    const sigToDelete = docSettings.signatures.find((s) => s.id === id);
    docSettings.signatures = docSettings.signatures.filter((s) => s.id !== id);

    if (sigToDelete?.isDefault && docSettings.signatures.length > 0) {
      docSettings.signatures[0].isDefault = true;
    }

    await docSettings.save();
    res.json({ message: 'Signature deleted successfully', signatures: docSettings.signatures });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setDefaultSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const docSettings = await DocumentSettings.findOne({ organization: req.user.organization });
    if (!docSettings) {
      return res.status(404).json({ error: 'Document settings not found' });
    }

    docSettings.signatures.forEach((sig) => {
      sig.isDefault = sig.id === id;
    });

    await docSettings.save();
    res.json({ message: 'Default signature updated', signatures: docSettings.signatures });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

