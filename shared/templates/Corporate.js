export const blurb = "Dark masthead with navy table headings";
export const css = `
.dcsheet.t-Corporate {
  --accent: #1B2A41;
  --line: #C6CCD5;
  --radius: 4px;
  --pad: 9px;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
}
.dcsheet.t-Corporate .dc-header {
  background: var(--accent);
  color: #fff;
  padding: 12px 14px;
  border-bottom: 3px solid #C8A047;
  margin-bottom: 10px;
}
.dcsheet.t-Corporate .dc-title, .dcsheet.t-Corporate .dc-subtitle { color: #fff; }
.dcsheet.t-Corporate .dc-title { color: #E7C87A; letter-spacing: 2px; }
.dcsheet.t-Corporate .dc-items th, .dcsheet.t-Corporate .dc-hsn th {
  background: var(--accent); color: #fff; border-color: var(--accent);
  text-transform: uppercase; font-size: 9px; letter-spacing: .5px;
}
.dcsheet.t-Corporate .dc-meta, .dcsheet.t-Corporate .dc-cust,
.dcsheet.t-Corporate .dc-mcell, .dcsheet.t-Corporate .dc-items,
.dcsheet.t-Corporate .dc-items td, .dcsheet.t-Corporate .dc-hsn,
.dcsheet.t-Corporate .dc-hsn td, .dcsheet.t-Corporate .dc-totals,
.dcsheet.t-Corporate .dc-totals-left, .dcsheet.t-Corporate .dc-footer,
.dcsheet.t-Corporate .dc-notes { border-color: var(--line); }
.dcsheet.t-Corporate .dc-label { color: var(--accent); }
.dcsheet.t-Corporate .dc-totals-right { background: #F3F5F8; }
.dcsheet.t-Corporate .dc-grand { color: var(--accent); border-top: 2px solid var(--accent); margin-top: 6px; }
.dcsheet.t-Corporate .dc-sign-line { border-top-color: var(--accent); }
`;
export { sharedHtml as html } from "./_sharedHtml.js";
