// One chrome for every message, carrying the TechDea brand.
//
// Email clients are not browsers. There is no external stylesheet, no reliable
// flexbox, no `gap`, and Outlook on Windows still renders through Word's HTML
// engine. So: nested tables, inline styles on every element, and a `bgcolor`
// attribute beside every CSS background so the colour survives where the CSS
// does not. Anything clever here degrades to something ugly rather than
// something broken.
//
// The logo is referenced by URL. It was originally attached inline (cid:), which
// is better for privacy — nothing is fetched when the message is opened — but
// Gmail lists any attached part as an attachment, so every password reset
// arrived with a "techdea-logo.png" chip under it in the inbox list. That looks
// like a suspicious file, which is the opposite of what a security email should
// look like.
//
// What we give up: a client that does not proxy images reveals an open. Gmail
// fetches through its own cache rather than per open, and we neither log nor
// correlate requests for a static file, so nothing here is used as tracking —
// but the signal exists, and that is the honest trade for the inbox appearance.
//
// If no usable URL is configured the image is dropped entirely and the header
// falls back to the wordmark, which is also what a recipient with images turned
// off sees.

const { html, raw } = require("../escape");

const BRAND = "TechDea";
const BRAND_FULL = "TechDea LMS";
const TAGLINE = "Converts Ideas Into Technologies";

// Must be absolute and https — a relative path or a localhost URL resolves to
// nothing inside somebody's mail client, and an http image is stripped or
// warned about by several of them.
function logoUrl() {
  const raw = String(process.env.MAIL_LOGO_URL || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).protocol === "https:" ? raw : "";
  } catch {
    return "";
  }
}

// Lifted from the app's design tokens (client/src/styles/design-system.css) so
// an email and the product it comes from do not look like different companies.
const C = {
  ink: "#181329",
  body: "#3b4048",
  muted: "#6f6a7c",
  soft: "#f5f2fb",
  page: "#faf9fd",
  divider: "#e7e3ee",
  accent: "#6d28d9",
  accentDeep: "#4c1d95",
  accentLight: "#b794f0",
  accentTint: "#f1eaff",
  accentTintEdge: "#e6d9ff",
  headerFrom: "#241a36",
  white: "#ffffff",
};

// Inter is the product's typeface, but a webfont cannot be relied on in mail —
// Gmail strips the <link> entirely. The stack degrades to whatever the platform
// calls its UI font, which is the closest honest match.
const FONT =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * The grey line of preview text a client shows beside the subject. Left empty,
 * clients scrape the first words of the body instead — usually "Use this code
 * to", which wastes the one line a person reads before deciding to open.
 *
 * The trailing entities push the body copy out of the preview, so the snippet
 * ends where we intend rather than running on into the markup.
 */
function preheaderBlock(text) {
  if (!text) return raw("");
  return raw(html`
    <div style="display:none; font-size:1px; color:${C.page}; line-height:1px; max-height:0;
                max-width:0; opacity:0; overflow:hidden;">
      ${text}${raw("&#847;&zwnj;&nbsp;".repeat(60))}
    </div>`);
}

/**
 * @param {object} opts
 * @param {string} opts.title       subject, reused as the document title
 * @param {string} opts.body        already-escaped markup from the template
 * @param {string} [opts.preheader] preview line, plain text
 * @param {string} [opts.footerNote] small print above the sign-off
 */
// Empty when there is no usable URL, which collapses the row to the wordmark
// alone rather than leaving a broken-image box in the header.
function logoCell() {
  const url = logoUrl();
  if (!url) return raw("");
  return raw(html`
    <td width="44" style="padding-right:12px; vertical-align:middle;">
      <img src="${url}" width="44" height="44" alt="${BRAND}"
           style="display:block; width:44px; height:44px; border:0; border-radius:50%;" />
    </td>`);
}

function layout({ title, body, preheader = "", footerNote = "" }) {
  return html`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${title}</title>
    <!--[if mso]>
      <style>body, table, td { font-family: 'Segoe UI', Arial, sans-serif !important; }</style>
    <![endif]-->
  </head>
  <body style="margin:0; padding:0; width:100%; background:${C.page};" bgcolor="${C.page}">
    ${preheaderBlock(preheader)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${C.page};" bgcolor="${C.page}">
      <tr>
        <td align="center" style="padding:32px 16px;">

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:560px; width:100%; background:${C.white};
                        border:1px solid ${C.divider}; border-radius:16px; overflow:hidden;">

            <!-- ── brand band ────────────────────────────────────────── -->
            <tr>
              <td bgcolor="${C.headerFrom}"
                  style="background:${C.headerFrom};
                         background-image:linear-gradient(135deg, ${C.headerFrom} 0%, ${C.accentDeep} 100%);
                         padding:24px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${logoCell()}
                    <td style="vertical-align:middle;">
                      <div style="font:850 20px/1.15 ${FONT}; letter-spacing:-0.5px; color:${C.white};">
                        Tech<span style="color:${C.accentLight};">Dea</span>
                      </div>
                      <div style="font:400 11px/1.4 ${FONT}; letter-spacing:0.3px; color:#9b93aa;
                                  text-transform:uppercase; padding-top:3px;">
                        ${TAGLINE}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ── message ───────────────────────────────────────────── -->
            <tr>
              <td style="padding:28px 28px 8px 28px;">
                <h1 style="margin:0 0 18px 0; font:800 21px/1.3 ${FONT};
                           letter-spacing:-0.3px; color:${C.ink};">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px 28px; font:400 15px/1.65 ${FONT}; color:${C.body};">
                ${raw(body)}
              </td>
            </tr>
          </table>

          <!-- ── footer ──────────────────────────────────────────────── -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="max-width:560px; width:100%;">
            <tr>
              <td align="center"
                  style="padding:18px 28px 4px 28px; font:400 12px/1.7 ${FONT}; color:${C.muted};">
                ${footerNote ? raw(html`${footerNote}<br /><br />`) : raw("")}Sent by
                <strong style="color:${C.muted};">${BRAND_FULL}</strong> — you're receiving this
                because of activity on your account.
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ── pieces templates compose with, so the styling lives in one place ───────

/** The six-digit code, as the visual centre of the message. */
function codePanel(display) {
  return raw(html`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 20px 0;">
      <tr>
        <td align="center" bgcolor="${C.accentTint}"
            style="background:${C.accentTint}; border:1px solid ${C.accentTintEdge};
                   border-radius:12px; padding:20px 16px;">
          <div style="font:700 32px/1.2 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                      letter-spacing:8px; color:${C.accentDeep}; white-space:nowrap;">${display}</div>
        </td>
      </tr>
    </table>`);
}

/** A quiet panel for a value the reader needs to recognise, such as an address. */
function factPanel(label, value) {
  return raw(html`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:0 0 20px 0;">
      <tr>
        <td bgcolor="${C.soft}"
            style="background:${C.soft}; border:1px solid ${C.divider}; border-radius:10px;
                   padding:14px 16px;">
          <div style="font:600 11px/1.4 ${FONT}; letter-spacing:0.4px; text-transform:uppercase;
                      color:${C.muted}; padding-bottom:4px;">${label}</div>
          <div style="font:600 15px/1.5 ${FONT}; color:${C.ink}; word-break:break-all;">${value}</div>
        </td>
      </tr>
    </table>`);
}

/** The "if this wasn't you" note, set apart above the footer. */
function alertNote(markup) {
  return raw(html`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin:20px 0 0 0; border-top:1px solid ${C.divider};">
      <tr>
        <td style="padding-top:18px; font:400 13.5px/1.65 ${FONT}; color:${C.muted};">
          ${raw(markup)}
        </td>
      </tr>
    </table>`);
}

module.exports = { layout, codePanel, factPanel, alertNote, logoUrl, BRAND, BRAND_FULL, C, FONT };
