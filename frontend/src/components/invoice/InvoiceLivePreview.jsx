import React from "react";

/*
 * Live, on-screen replica of the "Classic" invoice PDF (backend/utils/generatePdf.js).
 * It mirrors the same structure — org header, customer/invoice grid, items table
 * with #, Item, HSN/SAC, Rate/Item, Qty, Taxable Value, IGST, Amount, the totals
 * block with bank details, the HSN tax summary, and the notes/signature footer —
 * and re-renders live from the invoice form as the user edits it.
 *
 * Positions aren't pixel-identical to PDFKit's absolute coordinates, but the
 * sections, columns and values match what gets printed/downloaded.
 */

const fmt = (n) =>
  (Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date)) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("default", { month: "short" });
  return `${day} ${month} ${date.getFullYear()}`;
};

const InvoiceLivePreview = ({
  form,
  orgDetails,
  bankDetails,
  invoiceNumber,
  dealName,
  amountInWords,
}) => {
  const gstRate = Number(form.gstRate) || 18;
  const isTax = !!form.isTaxInvoice;

  const rows = (form.items || []).map((it) => {
    const rate = parseFloat(it.rate) || 0;
    const qty = parseFloat(it.quantity) || 0;
    const sub = rate * qty;
    const disc =
      it.discountType === "percentage"
        ? (sub * (parseFloat(it.discount) || 0)) / 100
        : parseFloat(it.discount) || 0;
    const taxable = sub - disc;
    const igst = isTax ? (taxable * gstRate) / 100 : 0;
    return {
      name: it.name || "",
      hsn: it.hsn || "",
      rate,
      qty,
      taxable,
      igst,
      amount: taxable + igst,
    };
  });

  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalTaxable = rows.reduce((s, r) => s + r.taxable, 0);
  const totalIGST = rows.reduce((s, r) => s + r.igst, 0);
  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  // HSN summary aggregation.
  const hsnMap = {};
  rows.forEach((r) => {
    const key = r.hsn || "N/A";
    if (!hsnMap[key]) hsnMap[key] = { taxable: 0, tax: 0, rate: gstRate };
    hsnMap[key].taxable += r.taxable;
    hsnMap[key].tax += r.igst;
  });
  const hsnRows = Object.keys(hsnMap).map((k) => ({ hsn: k, ...hsnMap[k] }));

  const org = orgDetails || {};
  const bank = bankDetails || {};

  const cell = "border border-black px-1.5 py-1 align-top";
  const th = "border border-black px-1.5 py-1 font-bold align-middle";

  return (
    <div className="w-full bg-white border border-gray-300 shadow-md p-4 sm:p-6 text-[11px] leading-snug text-black self-start">
      {/* 1. HEADER */}
      <div className="flex items-start justify-between gap-4 pb-3">
        <div className="flex items-start gap-3">
          {org.logoUrl ? (
            <img
              src={org.logoUrl}
              alt="logo"
              className="w-14 h-14 object-contain flex-shrink-0"
            />
          ) : null}
          <div>
            <div className="text-[15px] font-bold">
              {org.companyName || "Your Company"}
            </div>
            <div className="whitespace-pre-line text-[10px] max-w-[280px]">
              {org.address || ""}
            </div>
            <div className="font-bold text-[10px] mt-0.5">
              GSTIN: {org.gstin || "—"}
            </div>
            <div className="text-[10px]">
              Mobile: {org.mobile || "—"}
              {"   "}Email: {org.email || "—"}
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[13px] font-bold text-[#007bff]">
            {isTax ? "TAX INVOICE" : "INVOICE"}
          </div>
          <div className="text-[10px] font-bold">ORIGINAL FOR RECIPIENT</div>
        </div>
      </div>

      {/* 2. CUSTOMER + INVOICE GRID */}
      <div className="grid grid-cols-2 border border-black">
        {/* Left: customer */}
        <div className="border-r border-black p-2 space-y-1">
          <div className="font-bold">Customer Details:</div>
          <div className="font-bold">{dealName || "Customer Name"}</div>
          <div>GSTIN: {form.receiverGSTIN || ""}</div>
          <div className="font-bold pt-1">Billing address:</div>
          <div className="min-h-[28px]"></div>
          <div className="font-bold">Shipping address:</div>
        </div>
        {/* Right: invoice meta */}
        <div className="grid grid-cols-2">
          <div className={cell}>
            <div>Invoice #:</div>
            <div className="font-bold">{invoiceNumber || "—"}</div>
          </div>
          <div className={cell}>
            <div>Date:</div>
            <div className="font-bold">{formatDate(form.date) || "—"}</div>
          </div>
          <div className={cell}>
            <div>Place of Supply:</div>
            <div className="font-bold">{form.placeOfSupply || "—"}</div>
          </div>
          <div className={cell}>
            <div>Due Date:</div>
            <div className="font-bold">{formatDate(form.dueDate) || "—"}</div>
          </div>
          <div className={cell}>
            <div>Eway Bill #:</div>
            <div className="font-bold">&nbsp;</div>
          </div>
          <div className={cell}>
            <div>Vehicle Number:</div>
            <div className="font-bold">&nbsp;</div>
          </div>
          <div className={`${cell} col-span-2`}>
            <div className="font-bold">Dispatch From:</div>
            <div className="whitespace-pre-line">{org.address || ""}</div>
          </div>
        </div>
      </div>

      {/* 3. ITEMS TABLE */}
      <table className="w-full border-collapse mt-0 border border-black text-[10px]">
        <thead>
          <tr>
            <th className={`${th} text-center w-[24px]`}>#</th>
            <th className={`${th} text-left`}>Item</th>
            <th className={`${th} text-center w-[52px]`}>HSN/SAC</th>
            <th className={`${th} text-right w-[60px]`}>Rate/Item</th>
            <th className={`${th} text-right w-[46px]`}>Qty</th>
            <th className={`${th} text-right w-[74px]`}>Taxable Value</th>
            <th className={`${th} text-right w-[74px]`}>IGST</th>
            <th className={`${th} text-right w-[80px]`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className={`${cell} text-center`} colSpan={8}>
                &nbsp;
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                <td className={`${cell} text-center`}>{i + 1}</td>
                <td className={`${cell} font-bold`}>{r.name || "—"}</td>
                <td className={`${cell} text-center`}>{r.hsn}</td>
                <td className={`${cell} text-right`}>{fmt(r.rate)}</td>
                <td className={`${cell} text-right`}>{r.qty} BOX</td>
                <td className={`${cell} text-right`}>{fmt(r.taxable)}</td>
                <td className={`${cell} text-right`}>
                  {r.igst > 0 ? `${fmt(r.igst)} (${gstRate}%)` : ""}
                </td>
                <td className={`${cell} text-right`}>{fmt(r.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 4. TOTALS + BANK DETAILS */}
      <div className="grid grid-cols-2 border-l border-r border-b border-black">
        <div className="border-r border-black p-2 space-y-1">
          <div>
            Total Items / Qty : {rows.length} / {totalQty}
          </div>
          <div>
            Total amount (in words): INR {amountInWords || ""}
          </div>
          <div className="font-bold pt-1">Bank Details:</div>
          <div>Bank: {bank.bank || "—"}</div>
          <div>Account #: {bank.accountNumber || "—"}</div>
          <div>IFSC: {bank.ifscCode || "—"}</div>
          <div>Branch: {bank.branch || "—"}</div>
        </div>
        <div className="p-2">
          <div className="flex justify-between">
            <span className="font-bold">Taxable Amount</span>
            <span>₹{fmt(totalTaxable)}</span>
          </div>
          <div className="flex justify-between border-b border-black pb-1">
            <span className="font-bold">IGST {gstRate}%</span>
            <span>₹{fmt(totalIGST)}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-[14px] font-bold">Total</span>
            <span className="text-[14px]">₹{fmt(grandTotal)}</span>
          </div>
          <div className="flex justify-end items-center gap-1 pt-2 text-green-700">
            <span className="text-green-600">✓</span>
            <span className="text-black">Amount Paid</span>
          </div>
        </div>
      </div>

      {/* 5. HSN SUMMARY */}
      <table className="w-full border-collapse border border-black mt-2 text-[10px]">
        <thead>
          <tr>
            <th className={`${th}`} rowSpan={2}>
              HSN/SAC
            </th>
            <th className={`${th}`} rowSpan={2}>
              Taxable Value
            </th>
            <th className={`${th} text-center`} colSpan={2}>
              Integrated Tax
            </th>
            <th className={`${th}`} rowSpan={2}>
              Total Tax Amount
            </th>
          </tr>
          <tr>
            <th className={`${th} text-center`}>Rate</th>
            <th className={`${th} text-center`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {hsnRows.map((r, i) => (
            <tr key={i}>
              <td className={`${cell} text-center`}>{r.hsn}</td>
              <td className={`${cell} text-center`}>{fmt(r.taxable)}</td>
              <td className={`${cell} text-center`}>{r.rate}%</td>
              <td className={`${cell} text-right`}>{fmt(r.tax)}</td>
              <td className={`${cell} text-center`}>{fmt(r.tax)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={`${cell} text-right`}>TOTAL</td>
            <td className={`${cell} text-center`}>{fmt(totalTaxable)}</td>
            <td className={`${cell}`}></td>
            <td className={`${cell} text-right`}>{fmt(totalIGST)}</td>
            <td className={`${cell} text-center`}>{fmt(totalIGST)}</td>
          </tr>
        </tbody>
      </table>

      {/* 6. NOTES / TERMS / SIGNATURE */}
      <div className="grid grid-cols-[1fr_180px] border border-black mt-2">
        <div className="border-r border-black p-2">
          <div className="font-bold">Notes:</div>
          <div>Thank you for the Business!</div>
          <div className="font-bold pt-2">Terms and Conditions:</div>
          <div className="text-[9px] space-y-0.5 mt-0.5">
            <div>1. Goods once sold cannot be taken back or exchanged.</div>
            <div>
              2. We are not the manufacturers, company will stand for warranty...
            </div>
            <div>3. Subject to local Jurisdiction.</div>
          </div>
        </div>
        <div className="p-2 flex flex-col justify-between text-right">
          <div>For {org.companyName || "Your Company"}</div>
          <div>
            {org.signatureUrl ? (
              <img
                src={org.signatureUrl}
                alt="signature"
                className="h-10 ml-auto object-contain"
              />
            ) : (
              <div className="h-10" />
            )}
            <div className="border-t border-black pt-1 mt-1">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceLivePreview;
