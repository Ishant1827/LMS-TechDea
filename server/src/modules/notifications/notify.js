// The single entry point for outbound messages.
//
// Controllers call `notify(event, payload)` and nothing else. They do not know
// which template is used, which channel it goes over, or whether the user has
// opted out — and that is the point. When email gains a queue, or gains an
// in-app or SMS sibling, this file changes and no controller does.
//
// Today the body renders and sends inline. In the next phase it becomes an
// insert into an outbox collection that a worker drains, with retries and an
// idempotency key. The signature above is the part that must not move.

const { sendMail, MailDisabledError } = require("../../shared/mail/mailer");
const { logFatal } = require("../../shared/utils/logger");

// event -> envelope. Adding an email means adding a line here and a template to
// the registry; it never means importing the mailer into a controller.
const EVENTS = {
  "auth.otp.requested": ({ email, code, purpose, expiresMinutes }) => ({
    to: email,
    templateId: "otpCode",
    data: { code, purpose, expiresMinutes },
  }),

  "auth.password.changed": ({ email, name, changedAt }) => ({
    to: email,
    templateId: "passwordChanged",
    data: { name, changedAt },
  }),

  // `to` is the address being left behind, not the new one. That is the whole
  // point of this message — see the template.
  "auth.email.changed": ({ previousEmail, newEmail, name, changedAt }) => ({
    to: previousEmail,
    templateId: "emailChanged",
    data: { name, newEmail, changedAt },
  }),
};

// Addresses are useful in a log line and are also personal data, so they go in
// shortened. Enough to recognise the account you are debugging, not enough to
// harvest the roster out of the log view.
function maskEmail(address) {
  const [local = "", domain = ""] = String(address).split("@");
  const head = local.slice(0, 1) || "?";
  return `${head}${"*".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

/**
 * Never throws and never rejects. A message that could not be sent must not turn
 * into a failed request — a student whose welcome email bounced has still
 * registered, and an OTP that failed to send is recoverable by asking for
 * another one. Callers therefore do not await this.
 *
 * @returns {Promise<{ sent: boolean }>}
 */
async function notify(event, payload = {}) {
  const build = EVENTS[event];
  if (!build) {
    logFatal(`notify: unknown event "${event}"`, new Error("no handler registered"));
    return { sent: false };
  }

  let envelope;
  try {
    envelope = build(payload);
  } catch (err) {
    logFatal(`notify: could not build "${event}"`, err);
    return { sent: false };
  }

  try {
    await sendMail(envelope);
    return { sent: true };
  } catch (err) {
    const where = `notify: ${event} to ${maskEmail(envelope.to)}`;
    if (err instanceof MailDisabledError) {
      // Not a fault worth a stack trace — it is the documented state of a
      // deployment with no mail configured. Still says so, loudly enough to
      // explain why nobody received anything.
      console.warn(`[mail] ${where} — skipped, mail is disabled`);
    } else {
      logFatal(where, err);
    }
    return { sent: false };
  }
}

module.exports = { notify, maskEmail, EVENTS };
