// The only provider-aware file in the codebase.
//
// Everything above this layer speaks one interface:
//
//   send(envelope) -> { messageId }
//
// where `envelope` is { from, to, subject, text, html, replyTo? }. Nothing about
// a provider — not a field name, not an error shape — may leak upward. That is
// what keeps swapping one for another a change to this file and nothing else.
//
// ─────────────────────────────────────────────────────────────────────────────
// There is no live transport. SMTP was removed on 2026-09-18.
//
// It could not work where this is deployed: Render's free plan blocks outbound
// traffic to ports 25, 465 and 587 as an anti-spam policy, so the service
// connected to nothing and timed out on every send while the boot log read
// `transport=smtp`. No code change routes around a closed port. Separately, a
// free Gmail sender lands in spam for anyone who has not corresponded with us,
// because the address cannot be authenticated for a domain we own.
//
// The code is not kept here in comments — it is in git history, which is a
// better place for it (`git log -- src/shared/mail/transport.js`). The SMTP
// version, including the IPv4 dialling fix that a production outage taught us,
// is at commit d81c5b5 and earlier.
//
// To send mail again, add an adapter below with the same `send(envelope)` shape
// and a `case` in build(). Two routes:
//
//   * An HTTP email API (Resend, Brevo, Postmark). One POST over 443, which no
//     host blocks. Needs a domain you control — a free mail domain cannot be
//     verified by anyone, so it cannot be sent from.
//   * SMTP again, on a host that does not block the port. Then it needs
//     nodemailer back, TLS enforced, and IPv4 pinned if the host advertises
//     IPv6 without a route.
//
// Either way the domain is the part that decides inbox versus spam.
// ─────────────────────────────────────────────────────────────────────────────

const { mailConfig } = require("./config");

// Prints the message instead of sending it. Development only — this writes the
// full body, one-time codes included, to stdout, which is precisely why config.js
// refuses to let it run in production.
function consoleTransport() {
  return {
    async sendMail(envelope) {
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
      return { messageId: `console-${Date.now()}` };
    },
    async verify() {
      return true;
    },
    close() {},
  };
}

// Keeps the message so a test can assert on what would have gone out.
function jsonTransport() {
  const sent = [];
  return {
    async sendMail(envelope) {
      const message = { ...envelope };
      sent.push(message);
      return { messageId: `json-${sent.length}`, message: JSON.stringify(message) };
    },
    async verify() {
      return true;
    },
    sentMessages: sent,
    close() {
      sent.length = 0;
    },
  };
}

let cached = null;

function build() {
  const cfg = mailConfig();

  switch (cfg.mode) {
    case "json":
      return jsonTransport();
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

// Proves the transport works at boot rather than on the first password reset.
// Returns a reason instead of throwing: mail being down is not a reason for the
// API to refuse to serve courses.
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
