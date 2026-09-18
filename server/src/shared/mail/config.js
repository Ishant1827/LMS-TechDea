// Mail configuration is read once, at boot, and validated there. Reading
// process.env at send time means a half-configured deploy fails on the first
// password reset someone actually needs — at 11pm, on a Sunday — rather than on
// the deploy that broke it.
//
// Three modes, plus off:
//   console  prints the rendered message to stdout (development)
//   json     returns the message as JSON, asserted against (tests)
//   off      nothing is configured; any send throws a clear error
//
// `smtp` was the fourth and is gone — see transport.js. It is still recognised
// here, and only here, so that a deployment still carrying MAIL_TRANSPORT=smtp
// gets an explanation instead of a puzzle. That is four lines against an outage
// nobody would be able to read.
//
// There is deliberately no silent downgrade to a transport that pretends to
// send: a misconfiguration stops the boot (R10, A4).

const MODES = ["console", "json", "off"];

// Recognised well enough to explain itself, not well enough to run.
const REMOVED_MODES = {
  smtp:
    "the SMTP transport was removed — Render's free plan blocks outbound SMTP " +
    "ports (25, 465, 587), so it could never deliver from there. Unset " +
    "MAIL_TRANSPORT to disable email, or add a transport in " +
    "src/shared/mail/transport.js.",
};

// console and json print or return the full message body. In production that
// would write one-time codes into the platform's log view, so they are refused
// there outright rather than warned about.
const DEV_ONLY_MODES = ["console", "json"];

class MailConfigError extends Error {}

const isProd = () => process.env.NODE_ENV === "production";

function resolveMode() {
  const raw = String(process.env.MAIL_TRANSPORT || "").trim().toLowerCase();

  if (!raw) {
    // Unset is a legitimate state while the feature is being built: outside
    // production we want to see the mail, and in production we want sending to
    // fail loudly rather than to route codes through the logs.
    return isProd() ? "off" : "console";
  }
  if (REMOVED_MODES[raw]) {
    throw new MailConfigError(`MAIL_TRANSPORT="${raw}" — ${REMOVED_MODES[raw]}`);
  }
  if (!MODES.includes(raw)) {
    throw new MailConfigError(
      `MAIL_TRANSPORT must be one of ${MODES.join(", ")} — got "${raw}".`
    );
  }
  if (isProd() && DEV_ONLY_MODES.includes(raw)) {
    throw new MailConfigError(
      `MAIL_TRANSPORT="${raw}" prints message bodies, including one-time codes, ` +
        `and must never run in production. Leave MAIL_TRANSPORT unset to disable ` +
        `sending entirely, or restore a real transport — see transport.js.`
    );
  }
  return raw;
}

// An address with a newline in it is a header-injection attempt, and the sender
// address is the one place a value could reach the envelope without having come
// from a user record.
const ADDRESS = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function requireAddress(key) {
  const value = String(process.env[key] || "").trim();
  if (!value) throw new MailConfigError(`${key} is required when mail is enabled.`);
  if (!ADDRESS.test(value)) throw new MailConfigError(`${key} is not a valid email address.`);
  return value;
}

function optionalAddress(key) {
  const value = String(process.env[key] || "").trim();
  if (!value) return "";
  if (!ADDRESS.test(value)) throw new MailConfigError(`${key} is not a valid email address.`);
  return value;
}

// Real delivery needs a real sender. The console and json transports do not —
// nothing leaves the machine — so they fall back to a placeholder rather than
// refusing to boot a development server over a variable that does not matter yet.
const DEV_FROM = "no-reply@techdea.local";

function senderAddress() {
  // Nothing leaves the machine under console or json, so a placeholder is
  // honest. A real transport should require a real sender — add that check
  // beside it.
  return optionalAddress("MAIL_FROM") || DEV_FROM;
}

function build() {
  const mode = resolveMode();
  if (mode === "off") return Object.freeze({ mode, enabled: false });

  return Object.freeze({
    mode,
    enabled: true,
    from: senderAddress(),
    fromName: String(process.env.MAIL_FROM_NAME || "TechDea LMS").replace(/[\r\n"]/g, "").trim(),
    replyTo: optionalAddress("MAIL_REPLY_TO"),
  });
}

let cached = null;

function mailConfig() {
  if (!cached) cached = build();
  return cached;
}

// Called from index.js before the server starts listening, so a configuration
// mistake is a failed boot with a readable reason rather than a runtime surprise.
function assertMailConfig() {
  const cfg = mailConfig();
  if (!cfg.enabled) {
    console.warn("[mail] MAIL_TRANSPORT is not set — outbound email is disabled.");
  } else {
    console.log(`[mail] transport=${cfg.mode} from=${cfg.from}`);
  }
  return cfg;
}

// The one question the rest of the app asks. Everything email-shaped — the
// verification gate, the reset flow, the address-change card — is switched off
// by the same answer, so there is no second flag to forget.
function mailEnabled() {
  return mailConfig().enabled;
}

// Tests mutate process.env between cases; nothing else should need this.
function resetMailConfig() {
  cached = null;
}

module.exports = { mailConfig, mailEnabled, assertMailConfig, resetMailConfig, MailConfigError };
