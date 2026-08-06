const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInvoiceNumber, normalizeInvoiceNumberSettings, resolveInvoiceNumber } = require('../utils/documentNumbering');

test('buildInvoiceNumber uses prefix and suffix defaults', () => {
  const result = buildInvoiceNumber({ prefix: 'ACME', number: 12, suffix: '2026' });
  assert.equal(result, 'ACME-12-2026');
});

test('resolveInvoiceNumber uses saved defaults and increments the next number', () => {
  const settings = { invoicePrefix: 'INV', invoiceSuffix: 'A', nextInvoiceNumber: 7 };
  const resolved = resolveInvoiceNumber({ settings, providedNumber: null });
  assert.equal(resolved.invoiceNumber, 'INV-7-A');
  assert.equal(resolved.nextInvoiceNumber, 8);
});

test('normalizeInvoiceNumberSettings trims empty values and defaults the prefix', () => {
  const normalized = normalizeInvoiceNumberSettings({ invoicePrefix: '   ', invoiceSuffix: '  ', nextInvoiceNumber: 0 });
  assert.equal(normalized.invoicePrefix, 'INV-');
  assert.equal(normalized.invoiceSuffix, '');
  assert.equal(normalized.nextInvoiceNumber, 1);
});

test('normalizeInvoiceNumberSettings preserves saved prefix and suffix lists', () => {
  const normalized = normalizeInvoiceNumberSettings({
    invoicePrefix: 'ACME',
    invoiceSuffix: '2026',
    invoicePrefixes: ['INV', 'ACME', 'BIZ'],
    invoiceSuffixes: ['2025', '2026', '2027'],
  });

  assert.deepEqual(normalized.invoicePrefixes, ['INV', 'ACME', 'BIZ']);
  assert.deepEqual(normalized.invoiceSuffixes, ['2025', '2026', '2027']);
});

test('resolveInvoiceNumber uses the latest invoice number as the fallback when no explicit number is provided', () => {
  const resolved = resolveInvoiceNumber({
    settings: { invoicePrefix: 'INV', invoiceSuffix: '', nextInvoiceNumber: 1 },
    providedNumber: null,
    lastInvoiceNumber: 'INV-42-2026',
  });

  assert.equal(resolved.invoiceNumber, 'INV-43-2026');
  assert.equal(resolved.nextInvoiceNumber, 44);
});

test('buildInvoiceNumber uses the suffix when the prefix is blank', () => {
  const result = buildInvoiceNumber({ prefix: '', number: 12, suffix: '2026' });
  assert.equal(result, '12-2026');
});

test('buildInvoiceNumber defaults to INV when both prefix and suffix are blank', () => {
  const result = buildInvoiceNumber({ prefix: '', number: 12, suffix: '' });
  assert.equal(result, 'INV-12');
});
