const crypto = require('crypto');
const DocumentSettings = require('../models/DocumentSettings');

const DEFAULT_PREFIX = 'INV-';

const DEFAULT_DOCUMENT_TYPES = {
  invoice: { label: 'Invoice', prefix: 'INV-', suffix: '', prefixes: ['INV-'], suffixes: [] },
  quote: { label: 'Quote', prefix: 'QT', suffix: '', prefixes: ['QT', 'QTN'], suffixes: [] },
  proformaInvoice: { label: 'Proforma Invoice', prefix: 'PI', suffix: '', prefixes: ['PI', 'PFI'], suffixes: [] },
  deliveryChallan: { label: 'Delivery Challan', prefix: 'DC', suffix: '', prefixes: ['DC'], suffixes: [] },
};

function toList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => (value || '').toString().trim())
    .filter(Boolean);
}

function normalizeDocumentTypeSettings(documentTypeSettings = {}, fallback = {}) {
  const prefix = (documentTypeSettings.prefix || documentTypeSettings.invoicePrefix || fallback.prefix || '').toString().trim();
  const suffix = (documentTypeSettings.suffix || documentTypeSettings.invoiceSuffix || fallback.suffix || '').toString().trim();
  const prefixes = toList(documentTypeSettings.prefixes || documentTypeSettings.invoicePrefixes || fallback.prefixes);
  const suffixes = toList(documentTypeSettings.suffixes || documentTypeSettings.invoiceSuffixes || fallback.suffixes);

  return {
    prefix: prefix || fallback.prefix || DEFAULT_PREFIX,
    suffix,
    prefixes: prefixes.length ? prefixes : (fallback.prefixes && fallback.prefixes.length ? fallback.prefixes : [DEFAULT_PREFIX]),
    suffixes: suffixes.length ? suffixes : (fallback.suffixes || []),
  };
}

function normalizeDocumentTypeSettingsMap(documentTypeSettings = {}) {
  const normalized = {};
  Object.keys(DEFAULT_DOCUMENT_TYPES).forEach((documentTypeKey) => {
    const fallback = DEFAULT_DOCUMENT_TYPES[documentTypeKey];
    const incoming = documentTypeSettings?.[documentTypeKey] || {};
    normalized[documentTypeKey] = normalizeDocumentTypeSettings(incoming, fallback);
  });

  return normalized;
}

// Footer text keyed by document type. Only the accounting document types this
// app actually renders a footer for are accepted, so a malformed payload can't
// grow the document arbitrarily.
const FOOTER_DOC_TYPES = ['tax', 'performa', 'quotation', 'deliveryChallan'];

function normalizeFooterMap(map) {
  const out = {};
  if (!map || typeof map !== 'object') return out;
  for (const key of FOOTER_DOC_TYPES) {
    if (map[key] === undefined || map[key] === null) continue;
    out[key] = map[key].toString();
  }
  return out;
}

function normalizeInvoiceNumberSettings(settings = {}) {
  const documentTypeSettings = normalizeDocumentTypeSettingsMap(settings.documentTypeSettings || {});
  const invoiceSetting = documentTypeSettings.invoice;
  const invoicePrefix = (settings.invoicePrefix || invoiceSetting.prefix || '').toString().trim();
  const invoiceSuffix = (settings.invoiceSuffix || invoiceSetting.suffix || '').toString().trim();
  const nextInvoiceNumber = Number.isFinite(Number(settings.nextInvoiceNumber))
    ? Math.max(1, Number(settings.nextInvoiceNumber))
    : 1;

  const invoicePrefixes = toList(settings.invoicePrefixes || invoiceSetting.prefixes);
  const invoiceSuffixes = toList(settings.invoiceSuffixes || invoiceSetting.suffixes);

  return {
    invoicePrefix: invoicePrefix || invoiceSetting.prefix || DEFAULT_PREFIX,
    invoiceSuffix,
    invoicePrefixes: invoicePrefixes.length ? invoicePrefixes : (invoiceSetting.prefixes || [DEFAULT_PREFIX]),
    invoiceSuffixes: invoiceSuffixes.length ? invoiceSuffixes : (invoiceSetting.suffixes || []),
    nextInvoiceNumber,
    documentTypeSettings,
    defaultNotes: (settings.defaultNotes || '').toString(),
    defaultTerms: (settings.defaultTerms || '').toString(),
    // Per-document-type footer text. Types with nothing saved are simply
    // absent; callers fall back to the flat defaultNotes/defaultTerms above.
    defaultNotesByType: normalizeFooterMap(settings.defaultNotesByType),
    defaultTermsByType: normalizeFooterMap(settings.defaultTermsByType),
    documentTypes: Object.entries(DEFAULT_DOCUMENT_TYPES).map(([key, value]) => ({ key, label: value.label })),
    defaultDueDateDays: settings.defaultDueDateDays != null ? Number(settings.defaultDueDateDays) : null,
    whatsappTemplate: settings.whatsappTemplate != null ? String(settings.whatsappTemplate) : null,
    whatsappLine1: settings.whatsappLine1 != null ? String(settings.whatsappLine1) : 'Thanks for your business!',
    whatsappLine2: settings.whatsappLine2 != null ? String(settings.whatsappLine2) : '',
    smsTemplate: settings.smsTemplate != null ? String(settings.smsTemplate) : null,
    emailSubjectTemplate: settings.emailSubjectTemplate != null ? String(settings.emailSubjectTemplate) : null,
    emailBodyTemplate: settings.emailBodyTemplate != null ? String(settings.emailBodyTemplate) : null,
    whatsappTemplates: normalizeTemplateArray(settings.whatsappTemplates),
    smsTemplates: normalizeTemplateArray(settings.smsTemplates),
    emailTemplates: normalizeTemplateArray(settings.emailTemplates),
  };
}

function normalizeTemplateArray(list) {
  if (!Array.isArray(list)) return [];
  return list.map((t) => ({ ...t }));
}

// One-time migration: an organization that customized the old single-slot
// whatsappLine1/2, smsTemplate, or email templates before the template
// library existed would otherwise lose that customization the first time the
// new UI runs (empty array = "nothing saved"). Seeds one named entry per
// channel from the legacy fields so it carries forward, then returns whether
// anything changed so the caller knows to persist it.
function seedTemplateLibrariesFromLegacy(settings) {
  let changed = false;
  const out = {};

  if (!Array.isArray(settings.whatsappTemplates) || settings.whatsappTemplates.length === 0) {
    out.whatsappTemplates = [{
      id: crypto.randomUUID(),
      name: 'Default',
      line1: settings.whatsappLine1 || 'Thanks for your business!',
      line2: settings.whatsappLine2 || '',
      isDefault: true,
      createdAt: new Date(),
    }];
    changed = true;
  }

  if (!Array.isArray(settings.smsTemplates) || settings.smsTemplates.length === 0) {
    out.smsTemplates = [{
      id: crypto.randomUUID(),
      name: 'Default',
      body: settings.smsTemplate || 'Your {docType} #{number} from {company} is ready. View & Download: {link}',
      isDefault: true,
      createdAt: new Date(),
    }];
    changed = true;
  }

  if (!Array.isArray(settings.emailTemplates) || settings.emailTemplates.length === 0) {
    out.emailTemplates = [{
      id: crypto.randomUUID(),
      name: 'Default',
      subject: settings.emailSubjectTemplate || '{docType} {number} from {company}',
      body: settings.emailBodyTemplate || 'Hi {customerName},\n\nPlease find attached your {docType} #{number}.\n\nYou can also view and download it online:\n{link}\n\nThank you for your business!\n\nBest regards,\n{company}',
      isDefault: true,
      createdAt: new Date(),
    }];
    changed = true;
  }

  return { changed, fields: out };
}

function buildInvoiceNumber({ prefix, number, suffix }) {
  const normalizedPrefix = (prefix || '').toString().trim();
  const normalizedSuffix = (suffix || '').toString().trim();
  const normalizedNumber = Number(number);
  const hasPrefix = normalizedPrefix !== '';
  const hasSuffix = normalizedSuffix !== '';
  const effectivePrefix = hasPrefix ? normalizedPrefix : (hasSuffix ? '' : DEFAULT_PREFIX);
  const effectiveNumber = Number.isFinite(normalizedNumber) ? normalizedNumber.toString() : '';

  if (!effectiveNumber) {
    if (effectivePrefix && normalizedSuffix) {
      return `${effectivePrefix}-${normalizedSuffix}`;
    }

    return effectivePrefix || normalizedSuffix || DEFAULT_PREFIX;
  }

  const prefixWithSeparator = effectivePrefix && !effectivePrefix.endsWith('-') && (effectiveNumber || normalizedSuffix)
    ? `${effectivePrefix}-`
    : effectivePrefix;

  const suffixWithSeparator = normalizedSuffix && (effectiveNumber || effectivePrefix)
    ? `-${normalizedSuffix}`
    : '';

  return `${prefixWithSeparator}${effectiveNumber}${suffixWithSeparator}`;
}

function extractNumericInvoiceNumber(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const value = rawValue.toString().trim();
  if (!value) {
    return null;
  }

  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractInvoiceNumberParts(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const value = rawValue.toString().trim();
  if (!value) {
    return null;
  }

  const segments = value.split('-').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  if (segments.length >= 3) {
    const parsedNumber = Number(segments[segments.length - 2]);
    return Number.isFinite(parsedNumber)
      ? { number: parsedNumber, suffix: segments[segments.length - 1] }
      : null;
  }

  const parsedNumber = Number(segments[segments.length - 1]);
  return Number.isFinite(parsedNumber)
    ? { number: parsedNumber, suffix: '' }
    : null;
}

function resolveInvoiceNumber({ settings, providedNumber = null, lastInvoiceNumber = null }) {
  const normalizedSettings = normalizeInvoiceNumberSettings(settings);
  const hasExplicitNumber = typeof providedNumber === 'string'
    ? providedNumber.trim() !== ''
    : providedNumber !== null && providedNumber !== undefined;

  const fallbackNumber = extractNumericInvoiceNumber(lastInvoiceNumber);
  const fallbackParts = extractInvoiceNumberParts(lastInvoiceNumber);
  const suffixToUse = normalizedSettings.invoiceSuffix || fallbackParts?.suffix || '';
  const baseNumber = hasExplicitNumber
    ? providedNumber
    : (fallbackNumber !== null ? fallbackNumber + 1 : normalizedSettings.nextInvoiceNumber);
  const numberToUse = typeof baseNumber === 'string' && baseNumber.trim() !== '' ? Number(baseNumber) : baseNumber;
  const invoiceNumber = buildInvoiceNumber({
    prefix: normalizedSettings.invoicePrefix,
    number: numberToUse,
    suffix: suffixToUse,
  });

  return {
    invoiceNumber,
    nextInvoiceNumber: Number(numberToUse) + 1,
  };
}

async function getDocumentSettingsForOrganization(organizationId) {
  if (!organizationId) {
    return normalizeInvoiceNumberSettings({});
  }

  const settings = await DocumentSettings.findOne({ organization: organizationId }).lean();
  return normalizeInvoiceNumberSettings(settings || {});
}

async function saveDocumentSettingsForOrganization(organizationId, payload = {}) {
  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  const normalized = normalizeInvoiceNumberSettings(payload);
  const existing = await DocumentSettings.findOne({ organization: organizationId });

  const incomingDocumentTypeSettings = payload.documentTypeSettings && typeof payload.documentTypeSettings === 'object'
    ? payload.documentTypeSettings
    : {};

  const preparedDocumentTypeSettings = {};
  Object.keys(DEFAULT_DOCUMENT_TYPES).forEach((documentTypeKey) => {
    const incoming = incomingDocumentTypeSettings[documentTypeKey] || {};
    const fallback = documentTypeKey === 'invoice'
      ? {
          prefix: payload.invoicePrefix || normalized.invoicePrefix,
          suffix: payload.invoiceSuffix || normalized.invoiceSuffix,
          prefixes: payload.invoicePrefixes || normalized.invoicePrefixes,
          suffixes: payload.invoiceSuffixes || normalized.invoiceSuffixes,
        }
      : DEFAULT_DOCUMENT_TYPES[documentTypeKey];

    preparedDocumentTypeSettings[documentTypeKey] = normalizeDocumentTypeSettings(incoming, fallback);
  });

  const finalInvoicePrefix = payload.invoicePrefix?.toString().trim() || preparedDocumentTypeSettings.invoice.prefix;
  const finalInvoiceSuffix = payload.invoiceSuffix?.toString().trim() || preparedDocumentTypeSettings.invoice.suffix;

  const nextInvoicePrefixes = toList(payload.invoicePrefixes || preparedDocumentTypeSettings.invoice.prefixes);
  const nextInvoiceSuffixes = toList(payload.invoiceSuffixes || preparedDocumentTypeSettings.invoice.suffixes);

  const settingsPayload = {
    invoicePrefix: finalInvoicePrefix,
    invoiceSuffix: finalInvoiceSuffix,
    invoicePrefixes: nextInvoicePrefixes.length ? nextInvoicePrefixes : [DEFAULT_PREFIX],
    invoiceSuffixes: nextInvoiceSuffixes,
    documentTypeSettings: preparedDocumentTypeSettings,
    nextInvoiceNumber: normalized.nextInvoiceNumber,
  };

  // Footer boilerplate is only touched when the caller sends it, so saving
  // numbering settings alone can't wipe it.
  if (payload.defaultNotes !== undefined) {
    settingsPayload.defaultNotes = (payload.defaultNotes || '').toString();
  }
  if (payload.defaultTerms !== undefined) {
    settingsPayload.defaultTerms = (payload.defaultTerms || '').toString();
  }
  // Merged rather than replaced: the editor saves one document type at a time,
  // so sending just that key must not clear the others.
  if (payload.defaultNotesByType !== undefined) {
    settingsPayload.defaultNotesByType = {
      ...(existing?.defaultNotesByType || {}),
      ...normalizeFooterMap(payload.defaultNotesByType),
    };
  }
  if (payload.defaultTermsByType !== undefined) {
    settingsPayload.defaultTermsByType = {
      ...(existing?.defaultTermsByType || {}),
      ...normalizeFooterMap(payload.defaultTermsByType),
    };
  }
  if (payload.defaultDueDateDays !== undefined) {
    settingsPayload.defaultDueDateDays = payload.defaultDueDateDays != null ? Number(payload.defaultDueDateDays) : null;
  }
  if (payload.whatsappTemplate !== undefined) {
    settingsPayload.whatsappTemplate = (payload.whatsappTemplate || '').toString();
  }
  if (payload.whatsappLine1 !== undefined) {
    settingsPayload.whatsappLine1 = (payload.whatsappLine1 || '').toString();
  }
  if (payload.whatsappLine2 !== undefined) {
    settingsPayload.whatsappLine2 = (payload.whatsappLine2 || '').toString();
  }
  if (payload.smsTemplate !== undefined) {
    settingsPayload.smsTemplate = (payload.smsTemplate || '').toString();
  }
  if (payload.emailSubjectTemplate !== undefined) {
    settingsPayload.emailSubjectTemplate = (payload.emailSubjectTemplate || '').toString();
  }
  if (payload.emailBodyTemplate !== undefined) {
    settingsPayload.emailBodyTemplate = (payload.emailBodyTemplate || '').toString();
  }
  // Each array is sent whole by the Settings UI (it edits its local copy,
  // then saves the full list), so a plain replace is correct here — no merge.
  if (payload.whatsappTemplates !== undefined) {
    settingsPayload.whatsappTemplates = Array.isArray(payload.whatsappTemplates) ? payload.whatsappTemplates : [];
  }
  if (payload.smsTemplates !== undefined) {
    settingsPayload.smsTemplates = Array.isArray(payload.smsTemplates) ? payload.smsTemplates : [];
  }
  if (payload.emailTemplates !== undefined) {
    settingsPayload.emailTemplates = Array.isArray(payload.emailTemplates) ? payload.emailTemplates : [];
  }

  if (existing) {
    Object.assign(existing, settingsPayload);
    // Schema type Object: mongoose won't diff the nested keys on its own, so
    // say explicitly that these paths changed or the save is a no-op.
    for (const p of ['documentTypeSettings', 'defaultNotesByType', 'defaultTermsByType']) {
      if (settingsPayload[p] !== undefined) existing.markModified(p);
    }
    await existing.save();
    return existing;
  }

  const created = await DocumentSettings.create({ organization: organizationId, ...settingsPayload });
  return created;
}

module.exports = {
  DEFAULT_PREFIX,
  DEFAULT_DOCUMENT_TYPES,
  buildInvoiceNumber,
  normalizeInvoiceNumberSettings,
  resolveInvoiceNumber,
  getDocumentSettingsForOrganization,
  saveDocumentSettingsForOrganization,
  seedTemplateLibrariesFromLegacy,
};
