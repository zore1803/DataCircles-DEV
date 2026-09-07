export const blurb = "Serif type with a centred masthead";
export const css = `
.dcsheet.t-Elegant {
  --accent: #7A5C2E;
  --line: #C9BCA4;
  --ink: #23201B;
  --pad: 10px;
  font-family: Georgia, "Times New Roman", serif;
}
.dcsheet.t-Elegant .dc-header {
  display: block; text-align: center;
  border-bottom: 3px double var(--accent);
  padding-bottom: 14px; margin-bottom: 14px;
}
.dcsheet.t-Elegant .dc-org { display: block; }
.dcsheet.t-Elegant .dc-logo { margin: 0 auto 6px; display: block; }
.dcsheet.t-Elegant .dc-addr { max-width: none; }
.dcsheet.t-Elegant .dc-company { font-size: 20px; letter-spacing: 1px; font-weight: normal; }
.dcsheet.t-Elegant .dc-title-block { text-align: center; margin-top: 10px; }
.dcsheet.t-Elegant .dc-title { color: var(--accent); letter-spacing: 4px; font-size: 14px; font-weight: normal; }
.dcsheet.t-Elegant .dc-subtitle { font-weight: normal; font-style: italic; color: #6B6355; }
.dcsheet.t-Elegant .dc-meta, .dcsheet.t-Elegant .dc-cust,
.dcsheet.t-Elegant .dc-mcell, .dcsheet.t-Elegant .dc-items,
.dcsheet.t-Elegant .dc-items th, .dcsheet.t-Elegant .dc-items td,
.dcsheet.t-Elegant .dc-hsn, .dcsheet.t-Elegant .dc-hsn th,
.dcsheet.t-Elegant .dc-hsn td, .dcsheet.t-Elegant .dc-totals,
.dcsheet.t-Elegant .dc-totals-left, .dcsheet.t-Elegant .dc-footer,
.dcsheet.t-Elegant .dc-notes { border-color: var(--line); }
.dcsheet.t-Elegant .dc-items th, .dcsheet.t-Elegant .dc-hsn th {
  background: #F7F3EA; color: var(--accent);
  text-transform: uppercase; font-size: 9px; letter-spacing: 1px; font-weight: normal;
}
.dcsheet.t-Elegant .dc-label { font-weight: normal; color: var(--accent); text-transform: uppercase; font-size: 9px; letter-spacing: 1px; }
.dcsheet.t-Elegant .dc-grand { border-top: 3px double var(--accent); margin-top: 6px; font-weight: normal; }
.dcsheet.t-Elegant .dc-totals-right.dc-tax-single .dc-grand { border-top: 1px solid var(--line); }
.dcsheet.t-Elegant .dc-sign-line { border-top-color: var(--accent); }
`;
export { sharedHtml as html } from "./_sharedHtml.js";
