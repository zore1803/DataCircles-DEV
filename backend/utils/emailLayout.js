// utils/emailLayout.js
//
// One shared HTML shell for every DataCircles-authored email so they all
// look identical: centred logo, a black rule, an optional label/value
// detail grid with light row separators, optional section headings, a
// "Regards, ..." sign-off, and the standard DataCircles Technology footer.
//
// Usage:
//   const { renderEmail } = require('./emailLayout');
//   const html = renderEmail({
//     greetingName: 'Mr Chidambar Deshmukh',
//     intro: 'The following booking has been confirmed:',
//     blocks: [
//       { rows: [{ label: 'Booking ID', value: '#FT1285' }, ...] },
//       { heading: 'Assigned Driver and Vehicle', rows: [...] },
//     ],
//     ctaLabel: 'Choose a plan',
//     ctaUrl: 'https://portal.datacircles.in/subscription',
//   });

const LOGO_URL = 'https://www.datacircles.in/assets/DataCirclesBWLogo.jpg';

// Google Maps link for the registered office. The whole footer address is
// wrapped in this single anchor so mail clients don't auto-linkify it into a
// scatter of broken part-links.
const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=' +
  encodeURIComponent('Centura Square IT Park, Road No. 27, Wagle Estate, Thane West, Thane, Maharashtra 400604');

// Greys: the footer band is the darker grey; the page (outermost container)
// sits a shade or two lighter so the white card reads clearly against both.
const PAGE_BG = '#f1f5f9';   // outermost container
const FOOTER_BG = '#e2e8f0'; // footer band (darker)

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// rows: [{ label, value, isHtml }] -> the label/value grid with light rules.
function detailRows(rows) {
  const clean = (rows || []).filter(Boolean);
  return clean
    .map((r, i) => {
      const sep =
        i < clean.length - 1
          ? '<tr><td colspan="2" style="border-bottom:1px solid #ececec;font-size:0;line-height:0;">&nbsp;</td></tr>'
          : '';
      return `
        <tr>
          <td style="padding:12px 16px 12px 0;vertical-align:top;width:34%;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#333333;">${esc(r.label)}</td>
          <td style="padding:12px 0;vertical-align:top;font-size:14px;color:#111111;">${r.isHtml ? r.value : esc(r.value)}</td>
        </tr>${sep}`;
    })
    .join('');
}

// blocks: [{ heading?, rows?, html? }] rendered in order.
function contentBlocks(blocks) {
  return (blocks || [])
    .filter(Boolean)
    .map((b) => {
      let out = '';
      if (b.heading) {
        out += `<h3 style="margin:28px 0 6px;font-size:16px;font-weight:700;color:#111111;">${esc(b.heading)}</h3>`;
      }
      if (b.rows && b.rows.length) {
        out += `<table role="presentation" width="100%" style="border-collapse:collapse;margin:6px 0 4px;">${detailRows(b.rows)}</table>`;
      }
      if (b.html) out += b.html;
      return out;
    })
    .join('');
}

function ctaButton(label, url) {
  if (!label || !url) return '';
  return `
    <table role="presentation" width="100%" style="margin:28px 0 8px;">
      <tr><td align="center">
        <a href="${esc(url)}" style="background:#111111;color:#ffffff;text-decoration:none;padding:13px 34px;border-radius:4px;font-size:14px;font-weight:600;display:inline-block;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

/**
 * Build a complete email document.
 * @param {object}   o
 * @param {string}   [o.greetingName]  shown as "Hello <b>{name}</b>,". Omit for no greeting.
 * @param {string|string[]} [o.intro]  one or more intro paragraphs (plain text or safe HTML).
 * @param {Array}    [o.blocks]        ordered [{ heading?, rows?, html? }].
 * @param {string}   [o.ctaLabel]
 * @param {string}   [o.ctaUrl]
 * @param {string}   [o.closingHtml]   extra paragraph(s) after the blocks, before the sign-off.
 * @param {string|null} [o.signOff]    "Regards, <this>" line. Defaults to "Team DataCircles";
 *                                     pass null/'' to omit it (e.g. when the body carries its own).
 * @param {string}   [o.preheader]     hidden inbox-preview text.
 */
function renderEmail(o) {
  const opts = o || {};
  const intros = Array.isArray(opts.intro) ? opts.intro : opts.intro ? [opts.intro] : [];
  const signOff = 'signOff' in opts ? opts.signOff : 'Team DataCircles';
  const signOffHtml = signOff
    ? `<p style="margin:28px 0 0;font-size:15px;color:#111111;">Regards,<br>${esc(signOff)}</p>`
    : '';
  const year = new Date().getFullYear();

  const greeting = opts.greetingName
    ? `<p style="margin:0 0 18px;font-size:15px;color:#111111;">Hello <strong>${esc(opts.greetingName)}</strong>,</p>`
    : '';
  const introHtml = intros
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333333;">${p}</p>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>` : ''}
  <table role="presentation" width="100%" style="background:${PAGE_BG};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" style="background:#ffffff;max-width:600px;width:100%;">
        <tr><td style="background:#000000;padding:28px 40px;text-align:center;">
          <img src="${LOGO_URL}" alt="DataCircles" width="200" style="width:200px;max-width:60%;height:auto;display:inline-block;border:0;">
        </td></tr>
        <tr><td style="padding:0;font-size:0;line-height:0;"><div style="border-top:3px solid #000000;">&nbsp;</div></td></tr>
        <tr><td style="padding:32px 40px 36px;">
          ${greeting}
          ${introHtml}
          ${contentBlocks(opts.blocks)}
          ${ctaButton(opts.ctaLabel, opts.ctaUrl)}
          ${opts.closingHtml || ''}
          ${signOffHtml}
        </td></tr>
        <tr><td style="background:${FOOTER_BG};padding:26px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#333333;">DataCircles Technology</p>
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;">
            <a href="${MAP_URL}" style="color:#666666;text-decoration:underline;" target="_blank">Registered Office&nbsp;No.&nbsp;721, Centura Square IT Park, Road&nbsp;No.&nbsp;27, Wagle Estate,<br>Thane&nbsp;(West)&nbsp;-&nbsp;400604, Maharashtra, India</a>
          </p>
          <p style="margin:0 0 6px;font-size:12px;color:#666666;">+91 98208 77677 | 022 4662 7501</p>
          <p style="margin:0 0 10px;font-size:12px;color:#666666;"><a href="https://www.datacircles.in" style="color:#1a56db;text-decoration:none;">www.datacircles.in</a> | 27AJXPM6211H2ZT</p>
          <p style="margin:0;font-size:11px;color:#9aa0a6;">&copy; ${year} DataCircles Technology. All Rights Reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

module.exports = { renderEmail, LOGO_URL };
