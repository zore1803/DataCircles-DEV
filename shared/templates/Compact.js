export const blurb = "Dense layout that fits long item lists";
export const css = `
.dcsheet.t-Compact {
  --accent: #2B3A4A;
  --line: #B9C0C9;
  --pad: 5px;
  font-size: 10px;
  line-height: 1.25;
  padding: 14px;
}
.dcsheet.t-Compact .dc-header { padding-bottom: 8px; }
.dcsheet.t-Compact .dc-logo { width: 42px; height: 42px; }
.dcsheet.t-Compact .dc-company { font-size: 13px; }
.dcsheet.t-Compact .dc-addr, .dcsheet.t-Compact .dc-gstin, .dcsheet.t-Compact .dc-contact { font-size: 9px; }
.dcsheet.t-Compact .dc-title { font-size: 12px; }
.dcsheet.t-Compact .dc-items, .dcsheet.t-Compact .dc-hsn { font-size: 9px; }
.dcsheet.t-Compact .dc-items th, .dcsheet.t-Compact .dc-hsn th { background: #EEF1F5; padding: 3px 4px; }
.dcsheet.t-Compact .dc-items td, .dcsheet.t-Compact .dc-hsn td { padding: 3px 4px; }
.dcsheet.t-Compact .dc-grand { font-size: 12px; padding-top: 5px; }
.dcsheet.t-Compact .dc-terms { font-size: 8px; }
.dcsheet.t-Compact .dc-sign-img { height: 30px; }
`;
export { sharedHtml as html } from "./_sharedHtml.js";
