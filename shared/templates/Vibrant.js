export const blurb = "Emerald accents and rounded sections";
export const css = `
.dcsheet.t-Vibrant {
  --accent: #0E9F6E;
  --line: #CFE7DD;
  --radius: 12px;
  --pad: 10px;
  font-family: "Segoe UI", Arial, Helvetica, sans-serif;
}
.dcsheet.t-Vibrant .dc-header {
  border-bottom: 4px solid var(--accent);
  padding-bottom: 12px; margin-bottom: 12px;
}
.dcsheet.t-Vibrant .dc-title {
  background: var(--accent); color: #fff;
  padding: 4px 10px; border-radius: 999px; display: inline-block;
  letter-spacing: 1px;
}
.dcsheet.t-Vibrant .dc-subtitle { color: #6B7B76; }
.dcsheet.t-Vibrant .dc-meta { border-color: var(--line); }
.dcsheet.t-Vibrant .dc-cust, .dcsheet.t-Vibrant .dc-mcell { border-color: var(--line); }
.dcsheet.t-Vibrant .dc-cust { background: #F3FBF7; }
.dcsheet.t-Vibrant .dc-items { border-color: var(--line); border-radius: var(--radius); overflow: hidden; margin-top: 10px; }
.dcsheet.t-Vibrant .dc-items th {
  background: var(--accent); color: #fff; border: 0;
  text-transform: uppercase; font-size: 9px; letter-spacing: .5px;
}
.dcsheet.t-Vibrant .dc-items td { border: 0; border-bottom: 1px solid var(--line); }
.dcsheet.t-Vibrant .dc-totals { border: 0; margin-top: 10px; gap: 10px; }
.dcsheet.t-Vibrant .dc-totals-left { border: 1px solid var(--line); border-radius: var(--radius); }
.dcsheet.t-Vibrant .dc-totals-right { background: #EAF7F1; border-radius: var(--radius); }
.dcsheet.t-Vibrant .dc-grand { color: var(--accent); }
.dcsheet.t-Vibrant .dc-hsn { border-color: var(--line); border-radius: var(--radius); overflow: hidden; }
.dcsheet.t-Vibrant .dc-hsn th { background: #EAF7F1; border-color: var(--line); color: #0B6B4B; }
.dcsheet.t-Vibrant .dc-hsn td { border-color: var(--line); }
.dcsheet.t-Vibrant .dc-footer { border-color: var(--line); border-radius: var(--radius); }
.dcsheet.t-Vibrant .dc-notes { border-color: var(--line); }
`;
export { sharedHtml as html } from "./_sharedHtml.js";
