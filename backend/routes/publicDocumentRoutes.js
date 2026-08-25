const express = require('express');
const router = express.Router();
const axios = require('axios');
const sendGridMail = require('../utils/sendGridMail');

const Invoice = require('../models/Invoice');
const ProformaInvoice = require('../models/ProformaInvoice');
const Quotation = require('../models/quotation');
const DeliveryChallan = require('../models/deliveryChallan');
const Purchase = require('../models/Purchase');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseReturn = require('../models/PurchaseReturn');
const Branding = require('../models/Branding');
const getDefaultBankDetails = require('../utils/getDefaultBankDetails');
const htmlDocumentPdf = require('../utils/htmlDocumentPdf');
const purchaseDocumentPdf = require('../utils/purchaseDocumentPdf');

// canonical API path → model/meta
// Also accepts Accounting.jsx tab keys (tax, performa, quotation, deliveryChallan)
// so share URLs work whether generated with apiPathFor() or the raw tab key.
const MODELS = {
  invoices: Invoice,          tax: Invoice,
  'performa-invoices': ProformaInvoice, performa: ProformaInvoice,
  quotations: Quotation,      quotation: Quotation,
  'delivery-challans': DeliveryChallan, deliveryChallan: DeliveryChallan,
  purchase: Purchase,
  purchaseOrder: PurchaseOrder,
  purchaseReturn: PurchaseReturn,
};

// Purchase/PurchaseOrder/PurchaseReturn are vendor-facing (not deal-based)
// and use their own PDF template (utils/purchaseDocumentPdf.js) — every
// branch below checks this set instead of hardcoding the extra keys
// repeatedly.
const VENDOR_DOC_TYPES = new Set(['purchase', 'purchaseOrder', 'purchaseReturn']);

const NUMBER_KEYS = {
  invoices: 'invoiceNumber',          tax: 'invoiceNumber',
  'performa-invoices': 'performaInvoiceNumber', performa: 'performaInvoiceNumber',
  quotations: 'quotationNumber',      quotation: 'quotationNumber',
  'delivery-challans': 'deliveryChallanNumber', deliveryChallan: 'deliveryChallanNumber',
  purchase: 'purchaseNumber',
  purchaseOrder: 'poNumber',
  purchaseReturn: 'returnNumber',
};

const DOC_NAMES = {
  invoices: 'Invoice',                tax: 'Invoice',
  'performa-invoices': 'Pro Forma Invoice', performa: 'Pro Forma Invoice',
  quotations: 'Quotation',            quotation: 'Quotation',
  'delivery-challans': 'Delivery Challan', deliveryChallan: 'Delivery Challan',
  purchase: 'Purchase',
  purchaseOrder: 'Purchase Order',
  purchaseReturn: 'Purchase Return',
};

const DOC_TYPES = {
  invoices: 'invoice',                tax: 'invoice',
  'performa-invoices': 'performaInvoice', performa: 'performaInvoice',
  quotations: 'quotation',            quotation: 'quotation',
  'delivery-challans': 'deliveryChallan', deliveryChallan: 'deliveryChallan',
  purchase: 'purchase',
  purchaseOrder: 'purchaseOrder',
  purchaseReturn: 'purchaseReturn',
};

function resolveAmount(doc, type) {
  if (VENDOR_DOC_TYPES.has(type)) return doc.grandTotal ?? doc.totalAmount ?? 0;
  return doc.amount;
}

async function loadDoc(type, id) {
  const Model = MODELS[type];
  if (!Model) return null;
  if (VENDOR_DOC_TYPES.has(type)) return Model.findById(id).populate('vendor');
  return Model.findById(id).populate({
    path: 'deal',
    populate: ['contact', 'company'],
  });
}

// GET /api/public/:type/:id — document summary for the public view page
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!MODELS[type]) return res.status(400).json({ error: 'Invalid document type' });

    const doc = await loadDoc(type, id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const branding = await Branding.findOne({ organization: doc.organization }).sort({ updatedAt: -1 });

    const numKey = NUMBER_KEYS[type];
    const customerName = VENDOR_DOC_TYPES.has(type)
      ? doc.vendor?.name || 'Vendor'
      : doc.deal?.contact?.name ||
        doc.deal?.company?.name ||
        doc.deal?.contactPerson ||
        doc.deal?.title ||
        'Customer';

    res.json({
      number: doc[numKey],
      date: doc.date || doc.purchaseDate || doc.createdAt,
      dueDate: doc.dueDate || null,
      status: doc.status,
      amount: resolveAmount(doc, type),
      customerName,
      docName: DOC_NAMES[type],
      organizationName: branding?.companyName || 'Your Company',
      organizationLogo: branding?.logoUrl || null,
      primaryColor: branding?.colors?.primary || '#4F46E5',
    });
  } catch (err) {
    console.error('[public doc]', err);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

// GET /api/public/:type/:id/download — PDF download (no auth)
router.get('/:type/:id/download', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!MODELS[type]) return res.status(400).json({ error: 'Invalid document type' });

    const Model = MODELS[type];
    const isVendorDoc = VENDOR_DOC_TYPES.has(type);
    const doc = isVendorDoc
      ? await Model.findById(id)
          .populate('vendor')
          .populate('items.itemId', 'name description purchasePrice hsnSac gstRate')
      : await Model.findById(id)
          .populate({ path: 'deal', populate: ['contact', 'company'] })
          .populate('items.itemId');

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const orgDetails = await Branding.findOne({ organization: doc.organization }).sort({ updatedAt: -1 });

    let pdfBuffer;
    if (isVendorDoc) {
      pdfBuffer = await purchaseDocumentPdf(doc, orgDetails, doc.vendor, DOC_TYPES[type]);
    } else {
      const bankDetails = await getDefaultBankDetails(doc.organization);
      pdfBuffer = await htmlDocumentPdf(doc, bankDetails, orgDetails, DOC_TYPES[type]);
    }

    const numKey = NUMBER_KEYS[type];
    const filename = `${DOC_NAMES[type].replace(/ /g, '-')}-${doc[numKey] || id}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[public doc download]', err);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// POST /api/public/:type/:id/email — send doc via email (no auth, used from compose panel)
router.post('/:type/:id/email', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { email, cc, bcc, subject, body } = req.body;

    if (!email) return res.status(400).json({ error: 'Recipient email is required' });
    if (!MODELS[type]) return res.status(400).json({ error: 'Invalid document type' });

    const Model = MODELS[type];
    const isVendorDoc = VENDOR_DOC_TYPES.has(type);
    const doc = isVendorDoc
      ? await Model.findById(id)
          .populate('vendor')
          .populate('items.itemId', 'name description purchasePrice hsnSac gstRate')
      : await Model.findById(id)
          .populate({ path: 'deal', populate: ['contact', 'company'] })
          .populate('items.itemId');

    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const orgDetails = await Branding.findOne({ organization: doc.organization }).sort({ updatedAt: -1 });

    let pdfBuffer;
    if (isVendorDoc) {
      pdfBuffer = await purchaseDocumentPdf(doc, orgDetails, doc.vendor, DOC_TYPES[type]);
    } else {
      const bankDetails = await getDefaultBankDetails(doc.organization);
      pdfBuffer = await htmlDocumentPdf(doc, bankDetails, orgDetails, DOC_TYPES[type]);
    }

    const numKey = NUMBER_KEYS[type];
    const docName = DOC_NAMES[type];
    const docNum = doc[numKey] || '';
    const filename = `${docName.replace(/ /g, '-')}-${docNum}.pdf`;

    const htmlBody = body || `Please find attached your ${docName}.`;
    // The compose panel sends rich-text HTML; SendGrid still wants a
    // plain-text fallback for clients that don't render HTML, so strip tags
    // for the `text` field rather than sending markup as literal text.
    const textBody = htmlBody.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    // Cc/Bcc arrive as a comma-separated string from the compose panel;
    // SendGrid wants an array (or undefined, not an empty one).
    const toList = (raw) => (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ccList = toList(cc);
    const bccList = toList(bcc);

    await sendGridMail({
      to: email,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
      subject: subject || `${docName} ${docNum}`,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          // Puppeteer's page.pdf() returns a Uint8Array (not a Node Buffer,
          // since Puppeteer v22). Uint8Array#toString() ignores the 'base64'
          // arg and dumps comma-separated byte values instead — SendGrid then
          // rejects it as "not base64 encoded". Buffer.from() normalizes it
          // to a real Buffer first, where toString('base64') behaves as
          // intended.
          content: Buffer.from(pdfBuffer).toString('base64'),
          filename,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });

    console.log(`✅ [EMAIL] Sent to ${email} — ${docName} #${docNum}`);
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.log(`❌ [EMAIL] FAILED to send to ${req.body?.email} — ${err.message}`);
    console.error('[public doc email]', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

// Fast2SMS's `message` field is a string on some failure responses (e.g. the
// "complete a 100 INR transaction" account-restriction error) but an array
// of strings on its normal bulkV2 reject response — indexing with `[0]`
// unconditionally silently truncated a string message down to its first
// character, so the toast the user saw was a single garbled letter instead
// of the actual reason.
function extractFast2SmsMessage(data) {
  const msg = data?.message;
  return Array.isArray(msg) ? msg[0] : msg;
}

// POST /api/public/:type/:id/sms — send doc link via SMS (no auth, used from compose panel)
// Message text is composed client-side (from the org's saved SMS template),
// so this just relays it through Fast2SMS — no document lookup needed here.
router.post('/:type/:id/sms', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'Recipient phone number is required' });
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (!process.env.FAST2SMS_KEY) return res.status(500).json({ error: 'SMS is not configured on the server' });

    // Fast2SMS only accepts bare 10-digit Indian mobile numbers — no +91,
    // spaces, or dashes.
    const digits = phone.replace(/\D/g, '');
    const number = digits.length > 10 ? digits.slice(-10) : digits;
    if (number.length !== 10) return res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number' });

    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      { route: 'q', message, language: 'english', flash: 0, numbers: number },
      { headers: { authorization: process.env.FAST2SMS_KEY } }
    );

    if (response.data?.return !== true) {
      console.log(`❌ [SMS] FAILED to send to ${number} — ${JSON.stringify(response.data)}`);
      console.error('[public doc sms] Fast2SMS rejected:', response.data);
      return res.status(500).json({ error: extractFast2SmsMessage(response.data) || 'Failed to send SMS' });
    }

    console.log(`✅ [SMS] Sent to ${number}`);
    res.json({ message: 'SMS sent successfully' });
  } catch (err) {
    const fast2smsError = err.response?.data;
    console.log(`❌ [SMS] FAILED to send to ${req.body?.phone} — ${extractFast2SmsMessage(fast2smsError) || err.message}`);
    console.error('[public doc sms]', fast2smsError || err.message);
    res.status(500).json({ error: extractFast2SmsMessage(fast2smsError) || 'Failed to send SMS' });
  }
});

module.exports = router;
