// Ready-made Notes/Terms copy, keyed by the same document-type strings the
// backend uses for defaultNotesByType/defaultTermsByType (tax | performa |
// quotation | deliveryChallan). Used both by the Document Settings page (to
// seed the editable fields) and by the document creation forms (as the final
// fallback when an org hasn't customized or saved anything yet), so a brand
// new organization never has to type these by hand and every document form
// shows the same text.

export const PREDEFINED_NOTES = {
  tax: "Thank you for your business!",
  performa: "This is a Proforma Invoice and is not a demand for payment.",
  quotation: "Thank you for considering us. We look forward to working with you.",
  deliveryChallan: "Goods dispatched as per the details above.",
};

export const PREDEFINED_TERMS = {
  tax:
    "1. Payment is due within the specified due date.\n2. Goods once sold will not be taken back or exchanged.\n3. Subject to local jurisdiction only.",
  performa:
    "1. This is a Proforma Invoice for reference purposes only and is not a tax invoice.\n2. Prices and availability are subject to change without prior notice.\n3. Subject to local jurisdiction only.",
  quotation:
    "1. This quotation is valid for 15 days from the date of issue.\n2. Prices are subject to change without prior notice.\n3. Subject to local jurisdiction only.",
  deliveryChallan:
    "1. Please verify the goods upon receipt.\n2. This delivery challan is not a tax invoice.\n3. Subject to local jurisdiction only.",
};
