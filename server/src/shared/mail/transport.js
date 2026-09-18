// The only provider-aware file in the codebase.
//
// Everything above this layer speaks one interface:
//
//   send(envelope) -> { messageId }
//
// which is what makes moving from SMTP to a provider's HTTP API later a change
// to this file and nothing else. Keep it that way: no nodemailer type, option or
// error shape may leak upward.

const nodemailer = require("nodemailer");
const { mailConfig } = require("./config");

// Nodemailer opens a connection per transport, so it is built once and reused.
let cached = null;

function smtpTransport(cfg) {
  const { host, port, secure, user, pass } = cfg.smtp;

  return nodemailer.createTransport({
    host,
    port,
    secure, // true for 465; false means "start plain, then upgrade"

    // …and `requireTLS` is what makes that upgrade mandatory. Without it a
    // server that simply doesn't offer STARTTLS gets our credentials, and every
    // one-time code, in the clear.
    requireTLS: !secure,
    tls: { minVersion: "TLSv1.2" },
    // Note for whoever hits a certificate error here: `rejectUnauthorized: false`
    // is not the fix. It turns TLS into an unauthenticated channel that anyone
    // on the path can read. Fix the host name or the certificate instead.

    auth: { user, pass },

    // A single free-tier instance has no spare workers. Without these a hung
    // SMTP socket holds one until the platform kills the process.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,

    pool: true,
    maxConnections: 2,
    maxMessages: 100,
  });
}

// Prints the message instead of sending it. Development only — this writes the
// full body, one-time codes included, to stdout, which is precisely why config.js
// refuses to let it run in production.
function consoleTransport() {
  return {
    async sendMail(envelope) {
      const id = `console-${Date.now()}`;
      const rule = "─".repeat(64);
      console.log(
        [
          "",
          rule,
          "  EMAIL (not sent — MAIL_TRANSPORT=console)",
          rule,
          `  To:      ${envelope.to}`,
          `  From:    ${envelope.from}`,
          `  Subject: ${envelope.subject}`,
          rule,
          envelope.text,
          rule,
          "",
        ].join("\n")
      );
      return { messageId: id };
    },
    async verify() {
      return true;
    },
    close() {},
  };
}

function build() {
  const cfg = mailConfig();

  switch (cfg.mode) {
    case "smtp":
      return smtpTransport(cfg);
    case "json":
      return nodemailer.createTransport({ jsonTransport: true });
    case "console":
      return consoleTransport();
    default:
      // mailer.js checks `enabled` before reaching here; this is the backstop.
      throw new Error("Mail transport requested while mail is disabled.");
  }
}

function getTransport() {
  if (!cached) cached = build();
  return cached;
}

// Proves the credentials and the TLS handshake at boot rather than on the first
// password reset. Returns a reason instead of throwing: mail being down is not a
// reason for the API to refuse to serve courses.
async function verifyTransport() {
  const cfg = mailConfig();
  if (!cfg.enabled) return { ok: false, reason: "mail is disabled" };
  try {
    await getTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function closeTransport() {
  if (cached?.close) cached.close();
  cached = null;
}

module.exports = { getTransport, verifyTransport, closeTransport };
