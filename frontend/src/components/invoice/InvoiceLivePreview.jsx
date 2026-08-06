import React, { useMemo } from "react";
import {
  buildDocumentHtml,
  DEFAULT_TEMPLATE,
} from "../../../../shared/documentTemplates.js";

/*
 * Live, on-screen render of the document the user is editing.
 *
 * The markup and styling come from shared/documentTemplates.js — the very same
 * module the backend PDF generator uses — so what's shown here is what gets
 * downloaded and emailed. This component used to reimplement the layout in JSX
 * alongside a separate PDFKit generator, and the two drifted apart (discounts
 * appearing in one and not the other, different totals, different alignment).
 * Rendering the shared fragment makes that class of bug impossible.
 *
 * Every rule in the fragment is scoped under `.dcsheet`, so injecting it here
 * can't leak styles into the surrounding app chrome.
 */
const InvoiceLivePreview = ({
  form,
  orgDetails,
  bankDetails,
  invoiceNumber,
  dealName,
  type = "tax",
  template = DEFAULT_TEMPLATE,
  supportsTax = true,
}) => {
  const html = useMemo(() => {
    // The edit form keeps a single `isTaxInvoice` flag regardless of document
    // type, while saved documents store the quotation flag separately. Feed
    // both so the shared template reads the right one for this type.
    const taxOn = supportsTax && !!form.isTaxInvoice;
    const doc = {
      ...form,
      isTaxInvoice: taxOn,
      isTaxQuotation: taxOn,
    };

    return buildDocumentHtml(doc, {
      type,
      template,
      orgDetails,
      bankDetails,
      dealName,
      documentNumber: invoiceNumber,
    });
  }, [
    form,
    orgDetails,
    bankDetails,
    invoiceNumber,
    dealName,
    type,
    template,
    supportsTax,
  ]);

  return (
    <div
      className="w-full bg-white border border-gray-300 shadow-md self-start"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default InvoiceLivePreview;
