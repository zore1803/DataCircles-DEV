/**
 * pdfFilename.js
 *
 * Utility for building user-friendly PDF filenames from saved org settings.
 * No {placeholder} strings anywhere — everything is internal token keys resolved
 * to human-readable values at download time.
 */

// ─── Token catalogue ────────────────────────────────────────────────────────
// Each document type has its own set of available tokens with context-specific
// labels (e.g. "Customer Name" for invoices, "Vendor Name" for purchases).
//
// shape: { key, label, example }
export const TOKEN_DEFINITIONS = {
  tax: [
    { key: 'documentType',   label: 'Document Name',   example: 'Invoice' },
    { key: 'documentNumber', label: 'Invoice Number',   example: 'INV-00025' },
    { key: 'customerName',   label: 'Customer Name',   example: 'Acme Corp' },
    { key: 'companyName',    label: 'Company Name',    example: 'DataCircles' },
    { key: 'date',           label: 'Date',            example: '25-08-2026' },
  ],
  performa: [
    { key: 'documentType',   label: 'Document Name',          example: 'Pro Forma Invoice' },
    { key: 'documentNumber', label: 'Pro Forma Number',        example: 'PFI-00025' },
    { key: 'customerName',   label: 'Customer Name',          example: 'Acme Corp' },
    { key: 'companyName',    label: 'Company Name',           example: 'DataCircles' },
    { key: 'date',           label: 'Date',                   example: '25-08-2026' },
  ],
  quotation: [
    { key: 'documentType',   label: 'Document Name',   example: 'Quotation' },
    { key: 'documentNumber', label: 'Quotation Number', example: 'QT-00025' },
    { key: 'customerName',   label: 'Customer Name',   example: 'Acme Corp' },
    { key: 'companyName',    label: 'Company Name',    example: 'DataCircles' },
    { key: 'date',           label: 'Date',            example: '25-08-2026' },
  ],
  deliveryChallan: [
    { key: 'documentType',   label: 'Document Name',   example: 'Delivery Challan' },
    { key: 'documentNumber', label: 'Challan Number',  example: 'DC-00025' },
    { key: 'customerName',   label: 'Customer Name',   example: 'Acme Corp' },
    { key: 'companyName',    label: 'Company Name',    example: 'DataCircles' },
    { key: 'date',           label: 'Date',            example: '25-08-2026' },
  ],
  purchase: [
    { key: 'documentType',   label: 'Document Name',   example: 'Purchase' },
    { key: 'documentNumber', label: 'Purchase Number', example: 'PUR-00084' },
    { key: 'customerName',   label: 'Vendor Name',     example: 'MediCare Distributors' },
    { key: 'companyName',    label: 'Company Name',    example: 'DataCircles' },
    { key: 'date',           label: 'Date',            example: '25-08-2026' },
  ],
  purchaseOrder: [
    { key: 'documentType',   label: 'Document Name', example: 'Purchase Order' },
    { key: 'documentNumber', label: 'PO Number',     example: 'PO-00012' },
    { key: 'customerName',   label: 'Vendor Name',   example: 'MediCare Distributors' },
    { key: 'companyName',    label: 'Company Name',  example: 'DataCircles' },
    { key: 'date',           label: 'Date',          example: '25-08-2026' },
  ],
};

/**
 * Default token order when no org setting is saved yet.
 * Mirrors the backend model default.
 */
export const DEFAULT_FORMATS = {
  tax:             ['documentType', 'documentNumber', 'companyName'],
  performa:        ['documentType', 'documentNumber', 'companyName'],
  quotation:       ['documentType', 'documentNumber', 'companyName'],
  deliveryChallan: ['documentType', 'documentNumber', 'companyName'],
  purchase:        ['documentType', 'documentNumber', 'companyName'],
  purchaseOrder:   ['documentType', 'documentNumber', 'companyName'],
};

/**
 * Sanitize a string for use as a filename component.
 * Strips characters illegal in Windows / macOS / Linux filenames.
 */
const sanitize = (str) =>
  (str || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .trim();

/**
 * Build a filename from:
 *   @param {string[]} tokens  - ordered array of token keys, e.g. ['documentType','documentNumber']
 *   @param {object}   data    - { documentType, documentNumber, customerName, companyName, date }
 *   @returns {string}         - sanitized filename WITHOUT the .pdf extension
 *
 * Parts that resolve to an empty string are omitted so you don't get
 * "Invoice -  - " when fields are missing.
 */
export const buildFilename = (tokens, data) => {
  const parts = (tokens || [])
    .map((key) => sanitize(data[key] || ''))
    .filter(Boolean);

  const result = parts.join(' - ');
  return result || 'Document';
};

/**
 * Helper: given a raw document object and its type key, extract the standard
 * data fields expected by buildFilename().
 *
 * @param {object} doc      - raw document from API
 * @param {string} docType  - one of: tax | performa | quotation | deliveryChallan | purchase | purchaseOrder
 * @param {string} orgName  - the org's company name from Branding (for companyName token)
 * @returns {object}        - { documentType, documentNumber, customerName, companyName, date }
 */
export const extractDocData = (doc, docType, orgName = '') => {
  const TYPE_LABELS = {
    tax:             'Invoice',
    performa:        'Pro Forma Invoice',
    quotation:       'Quotation',
    deliveryChallan: 'Delivery Challan',
    purchase:        'Purchase',
    purchaseOrder:   'Purchase Order',
  };

  const number =
    doc?.invoiceNumber ||
    doc?.performaInvoiceNumber ||
    doc?.quotationNumber ||
    doc?.deliveryChallanNumber ||
    doc?.challanNumber ||
    doc?.purchaseNumber ||
    doc?.purchaseOrderNumber ||
    doc?.poNumber ||
    '';

  const customer =
    doc?.client?.name ||
    doc?.customer?.name ||
    doc?.vendor?.name ||
    '';

  const rawDate =
    doc?.invoiceDate ||
    doc?.performaInvoiceDate ||
    doc?.quotationDate ||
    doc?.challanDate ||
    doc?.purchaseDate ||
    doc?.orderDate ||
    doc?.createdAt;

  const date = rawDate
    ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return {
    documentType:   TYPE_LABELS[docType] || '',
    documentNumber: number,
    customerName:   customer,
    companyName:    orgName,
    date,
  };
};
