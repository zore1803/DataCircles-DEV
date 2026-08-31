const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceToEinvoicePayload, computeLineTax, toUQC } = require('../utils/eInvoiceMapper');

// Shared fixtures — real-shape objects, mirroring what the service passes in.
const seller = {
  legalName: 'DataCircles Pvt Ltd',
  gstin: '27ABCDE1234F1Z5',
  addr1: '5th Floor, Some Building',
  addr2: '',
  loc: 'Mumbai',
  pin: '400001',
  stateName: 'Maharashtra',
};
const buyerIntra = {
  legalName: 'Acme Corp',
  gstin: '27XYZAB5678C2D9',
  addr1: 'Plot 12',
  addr2: '',
  loc: 'Pune',
  pin: '411001',
  stateName: 'Maharashtra',
  posStateName: 'Maharashtra',
};
const buyerInter = { ...buyerIntra, gstin: '29LMNOP4321Q9R8', stateName: 'Karnataka', posStateName: 'Karnataka', loc: 'Bengaluru', pin: '560001' };
const settings = { supplyType: 'B2B', reverseCharge: false, docType: 'INV' };

const baseInvoice = {
  invoiceNumber: 'INV-100',
  date: new Date('2026-08-27'),
  amount: 118,
  transactionType: 'intra',
  items: [{
    name: 'Widget',
    hsn: '8471',
    quantity: 1,
    rate: 100,
    gstRate: 18,
    taxInclusive: false,
    discount: 0,
    discountType: 'amount',
    unit: 'NOS NUMBERS',
  }],
};

test('toUQC extracts the 3-letter prefix and defaults to NOS', () => {
  assert.equal(toUQC('NOS NUMBERS'), 'NOS');
  assert.equal(toUQC('KGS KILOGRAMS'), 'KGS');
  assert.equal(toUQC(''), 'NOS');
  assert.equal(toUQC(null), 'NOS');
});

test('computeLineTax splits CGST/SGST on intra-state, IGST on inter-state', () => {
  const intra = computeLineTax({ quantity: 1, rate: 100, gstRate: 18 }, 'intra');
  assert.equal(intra.taxableValue, 100);
  assert.equal(intra.cgst, 9);
  assert.equal(intra.sgst, 9);
  assert.equal(intra.igst, 0);
  assert.equal(intra.totalItemValue, 118);

  const inter = computeLineTax({ quantity: 1, rate: 100, gstRate: 18 }, 'inter');
  assert.equal(inter.igst, 18);
  assert.equal(inter.cgst, 0);
  assert.equal(inter.sgst, 0);
});

test('computeLineTax unwraps a tax-inclusive rate before applying GST', () => {
  const tax = computeLineTax({ quantity: 1, rate: 118, gstRate: 18, taxInclusive: true }, 'intra');
  assert.equal(tax.taxableValue, 100);
  assert.equal(tax.cgst, 9);
  assert.equal(tax.sgst, 9);
  assert.equal(tax.totalItemValue, 118);
  assert.equal(tax.unitPriceForIrp, 100);
});

test('computeLineTax applies percentage line-discounts before tax', () => {
  const tax = computeLineTax({ quantity: 2, rate: 100, gstRate: 18, discountType: 'percentage', discount: 10 }, 'intra');
  assert.equal(tax.subtotal, 200);
  assert.equal(tax.discount, 20);
  assert.equal(tax.taxableValue, 180);
});

test('invoiceToEinvoicePayload builds a valid IRP envelope for an intra-state B2B invoice', () => {
  const { payload, totals, errors } = invoiceToEinvoicePayload({ invoice: baseInvoice, seller, buyer: buyerIntra, settings });
  assert.equal(errors.length, 0);
  assert.equal(payload.Version, '1.1');
  assert.equal(payload.TranDtls.SupTyp, 'B2B');
  assert.equal(payload.TranDtls.RegRev, 'N');
  assert.equal(payload.DocDtls.Typ, 'INV');
  assert.equal(payload.DocDtls.No, 'INV-100');
  assert.equal(payload.SellerDtls.Stcd, '27');
  assert.equal(payload.BuyerDtls.Stcd, '27');
  assert.equal(payload.BuyerDtls.Pos, '27');
  assert.equal(payload.ItemList.length, 1);
  assert.equal(payload.ItemList[0].HsnCd, '8471');
  assert.equal(payload.ItemList[0].Unit, 'NOS');
  assert.equal(payload.ItemList[0].CgstAmt, 9);
  assert.equal(payload.ItemList[0].SgstAmt, 9);
  assert.equal(payload.ItemList[0].IgstAmt, 0);
  assert.equal(payload.ValDtls.TotInvVal, 118);
  assert.equal(totals.grandTotal, 118);
});

test('invoiceToEinvoicePayload routes to IGST when transactionType is inter', () => {
  const { payload } = invoiceToEinvoicePayload({
    invoice: { ...baseInvoice, transactionType: 'inter' },
    seller,
    buyer: buyerInter,
    settings,
  });
  assert.equal(payload.SellerDtls.Stcd, '27');
  assert.equal(payload.BuyerDtls.Stcd, '29');
  assert.equal(payload.ItemList[0].IgstAmt, 18);
  assert.equal(payload.ValDtls.IgstVal, 18);
  assert.equal(payload.ValDtls.CgstVal, 0);
});

test('invoiceToEinvoicePayload reports missing mandatory fields instead of guessing', () => {
  const { errors } = invoiceToEinvoicePayload({
    invoice: { ...baseInvoice, items: [{ name: 'x', quantity: 1, rate: 100, gstRate: 18 }] }, // no HSN
    seller,
    buyer: { ...buyerIntra, pin: '' },
    settings,
  });
  assert.ok(errors.some((e) => /HSN/.test(e)), `expected an HSN error, got: ${errors.join(', ')}`);
  assert.ok(errors.some((e) => /Buyer PIN/i.test(e)), `expected a buyer PIN error, got: ${errors.join(', ')}`);
});

test('invoiceToEinvoicePayload defaults unregistered buyers to URP', () => {
  const { payload } = invoiceToEinvoicePayload({
    invoice: baseInvoice,
    seller,
    buyer: { ...buyerIntra, gstin: '' },
    settings,
  });
  assert.equal(payload.BuyerDtls.Gstin, 'URP');
});

test('invoiceToEinvoicePayload warns when computed grand total drifts from stored amount', () => {
  const { warnings } = invoiceToEinvoicePayload({
    invoice: { ...baseInvoice, amount: 999 }, // stored value out of sync
    seller,
    buyer: buyerIntra,
    settings,
  });
  assert.ok(warnings.some((w) => /grand total/.test(w)));
});
