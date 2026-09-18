// Renders a template and hands the result to the transport.
//
// Two things happen here that are easy to leave out and expensive to add back:
// the recipient is validated as a single, newline-free address, and anything
// thrown on the way out is redacted before it becomes a log line.

const { mailConfig } = require("./config");
const { getTransport } = require("./transport");
const { render } = require("./render");

// Nothing is attached to these messages, deliberately. The brand mark is
// referenced by URL instead — see _layout.js. Gmail lists any attached part as
// an attachment, and a password reset arriving with a .png chip under it reads
// as suspicious rather than as branded.

class MailDisabledError extends Error {
  constructor() {
    super("Mail is not configured (MAIL_TRANSPORT is unset).");
    this.name = "MailDisabledError";
  }
}

const ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// Recipients are supposed to arrive from a user record, where the schema has
// already had its say. This is the second lock: a newline in a header value ends
// that header and begins another, so an address carrying one is not a typo, it is
// an attempt to add a Bcc. A comma is refused for the same reason — one call,
// one recipient, so a stray address cannot ride along.
function assertRecipient(to) {
  const value = String(to ?? "").trim();
  if (!value) throw new Error("mail: no recipient");
  if (/[\r\n]/.test(value)) throw new Error("mail: recipient contains a line break");
  if (!ADDRESS.test(value)) throw new Error("mail: recipient is not a single valid address");
  return value;
}

// Error messages from an SMTP library quote what they were handling, which can
// include the credential that failed to authenticate. And a rendering failure
// deep in a template could carry the one-time code with it. Neither belongs in
// the log view, so both are scrubbed on the way out (M11).
function redact(message) {
  let out = String(message ?? "");

  const secrets = [process.env.SMTP_PASS, process.env.OTP_PEPPER].filter(
    (s) => s && String(s).length >= 4
  );
  for (const secret of secrets) out = out.split(secret).join("[redacted]");

  // Any bare six-digit run is treated as a code. False positives here cost a
  // slightly vaguer log line; a false negative costs a live credential.
  return out.replace(/\b\d{6}\b/g, "[redacted]");
}

/**
 * @param {{ to: string, templateId: string, data?: object }} message
 * @returns {Promise<{ messageId: string, category: string }>}
 */
async function sendMail({ to, templateId, data }) {
  const cfg = mailConfig();
  if (!cfg.enabled) throw new MailDisabledError();

  const recipient = assertRecipient(to);
  const { subject, text, html, category } = render(templateId, data);

  const envelope = {
    from: cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from,
    to: recipient,
    subject,
    text,
    html,
    ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {}),
  };

  try {
    const info = await getTransport().sendMail(envelope);
    return { messageId: info.messageId, category };
  } catch (err) {
    const wrapped = new Error(`mail send failed [${templateId}] — ${redact(err.message)}`);
    wrapped.cause = undefined; // the original carries the unredacted text
    throw wrapped;
  }
}

module.exports = { sendMail, MailDisabledError, redact };
