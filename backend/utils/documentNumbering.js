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
    documentTypes: Object.entries(DEFAULT_DOCUMENT_TYPES).map(([key, value]) => ({ key, label: value.label })),
  };
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

  if (existing) {
    Object.assign(existing, settingsPayload);
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
};
