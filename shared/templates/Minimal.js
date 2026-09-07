export const blurb = "Hairline rules and generous spacing";
export const css = `
.dcsheet.t-Minimal {
  --accent: #111;
  --line: #E3E3E3;
  --muted: #777;
  --pad: 10px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}
.dcsheet.t-Minimal .dc-header { border-bottom: 1px solid var(--line); padding-bottom: 16px; margin-bottom: 14px; }
.dcsheet.t-Minimal .dc-title { color: #111; font-weight: 600; letter-spacing: 2px; font-size: 14px; }
.dcsheet.t-Minimal .dc-subtitle { color: var(--muted); font-weight: normal; }
.dcsheet.t-Minimal .dc-meta { border: 0; }
.dcsheet.t-Minimal .dc-cust { border-right: 0; padding-left: 0; }
.dcsheet.t-Minimal .dc-mcell { border: 0; padding: 4px 6px 8px 0; }
.dcsheet.t-Minimal .dc-mcell > span:first-child { color: var(--muted); font-size: 9px; text-transform: uppercase; letter-spacing: .6px; }
.dcsheet.t-Minimal .dc-label { font-weight: 600; }
.dcsheet.t-Minimal .dc-items { border: 0; margin-top: 14px; }
.dcsheet.t-Minimal .dc-items th {
  border: 0; border-bottom: 1px solid #111; padding-left: 0; padding-right: 0;
  text-transform: uppercase; font-size: 9px; letter-spacing: .6px; font-weight: 600;
}
.dcsheet.t-Minimal .dc-items td { border: 0; border-bottom: 1px solid var(--line); padding: 7px 0; }
.dcsheet.t-Minimal .dc-items th + th, .dcsheet.t-Minimal .dc-items td + td { padding-left: 8px; }
.dcsheet.t-Minimal .dc-item-name { font-weight: 600; }
.dcsheet.t-Minimal .dc-totals { border: 0; margin-top: 14px; }
.dcsheet.t-Minimal .dc-totals-left { border-right: 0; padding-left: 0; }
.dcsheet.t-Minimal .dc-totals-right { padding-right: 0; }
.dcsheet.t-Minimal .dc-trow.sep { border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.dcsheet.t-Minimal .dc-grand { border-top: 1px solid #111; margin-top: 6px; padding-top: 8px; }
.dcsheet.t-Minimal .dc-hsn { border: 0; margin-top: 16px; }
.dcsheet.t-Minimal .dc-hsn th { border: 0; border-bottom: 1px solid #111; padding-left: 0; text-transform: uppercase; font-size: 9px; letter-spacing: .6px; }
.dcsheet.t-Minimal .dc-hsn td { border: 0; border-bottom: 1px solid var(--line); padding-left: 0; }
.dcsheet.t-Minimal .dc-footer { border: 0; border-top: 1px solid var(--line); margin-top: 16px; padding-top: 10px; }
.dcsheet.t-Minimal .dc-notes { border-right: 0; padding-left: 0; }
.dcsheet.t-Minimal .dc-sign { padding-right: 0; }
`;
export { sharedHtml as html } from "./_sharedHtml.js";
