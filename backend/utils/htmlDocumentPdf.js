const puppeteer = require("puppeteer");
const { getTemplatesForOrg } = require("../controllers/documentTemplateSettingsController");

/*
 * Prints an accounting document to PDF by rendering the *same* markup the
 * on-screen live preview uses and letting headless Chrome lay it out.
 *
 * The markup, styling and arithmetic all come from shared/documentTemplates.js,
 * which the frontend preview imports too — so the downloaded/emailed PDF cannot
 * drift away from what the user approved on screen. This replaced a set of
 * PDFKit generators that positioned every line at hardcoded coordinates and
 * fell apart whenever content was longer than assumed.
 */

// The shared templates are ESM and this file is CommonJS, so it's pulled in
// with a dynamic import and cached after the first call.
let templatesPromise = null;
function loadTemplates() {
  if (!templatesPromise) {
    templatesPromise = import("../../shared/documentTemplates.js");
  }
  return templatesPromise;
}

// One Chromium instance is reused across requests — launching it per PDF costs
// ~1s and tens of MB. Re-launch if it died so a crashed browser doesn't
// permanently break downloads.
let sharedBrowserPromise = null;
async function getBrowser() {
  if (sharedBrowserPromise) {
    try {
      const existing = await sharedBrowserPromise;
      if (existing.connected) return existing;
    } catch {
      // fall through and relaunch
    }
  }
  sharedBrowserPromise = puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  return sharedBrowserPromise;
}

/*
 * The template is an organization-wide choice made in the Template drawer and
 * applies to every document of that type — including ones saved earlier, which
 * may still carry a legacy `style` field. That stored value is deliberately
 * ignored so changing the template restyles the whole set at once.
 */
async function resolveTemplate(doc, organization, DEFAULT_TEMPLATE, type) {
  if (!organization) return DEFAULT_TEMPLATE;
  try {
    const templates = await getTemplatesForOrg(organization);
    return templates?.[type] || DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

module.exports = async function htmlDocumentPdf(
  doc,
  bankDetails,
  orgDetails,
  type = "tax"
) {
  const { buildDocumentHtml, DEFAULT_TEMPLATE } = await loadTemplates();

  const template = await resolveTemplate(
    doc,
    doc?.organization || orgDetails?.organization,
    DEFAULT_TEMPLATE,
    type
  );

  const fragment = buildDocumentHtml(doc, {
    type,
    template,
    orgDetails,
    bankDetails,
  });

  // A4 at 96dpi is 794px wide; with the 16px page margins the content box is
  // ~762px, which matches the preview sheet's design width so the two render
  // at the same proportions.
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; }
  .dcsheet { padding: 4px !important; }
</style>
</head>
<body>${fragment}</body>
</html>`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16px", bottom: "16px", left: "16px", right: "16px" },
    });
  } finally {
    await page.close();
  }
};
