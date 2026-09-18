// Mail configuration is read once, at boot, and validated there. Reading
// process.env at send time means a half-configured deploy fails on the first
// password reset someone actually needs — at 11pm, on a Sunday — rather than on
// the deploy that broke it.
//
// Four modes:
//   smtp     real delivery
//   console  prints the rendered message to stdout (development)
//   json     returns the message as JSON, asserted against (tests)
//   off      nothing is configured; any send throws a clear error
//
// There is deliberately no fallback from `smtp` to anything else. A misconfigured
// SMTP host must stop the boot, not silently downgrade to a transport that
// pretends to send (R10, A4).

const MODES = ["smtp", "console", "json", "off"];

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
  if (!MODES.includes(raw)) {
    throw new MailConfigError(
      `MAIL_TRANSPORT must be one of ${MODES.join(", ")} — got "${raw}".`
    );
  }
  if (isProd() && DEV_ONLY_MODES.includes(raw)) {
    throw new MailConfigError(
      `MAIL_TRANSPORT="${raw}" prints message bodies, including one-time codes, ` +
        `and must never run in production. Set MAIL_TRANSPORT=smtp, or leave it ` +
        `unset to disable sending entirely.`
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

function requireValue(key) {
  const value = String(process.env[key] || "").trim();
  if (!value) throw new MailConfigError(`${key} is required when MAIL_TRANSPORT=smtp.`);
  return value;
}

function smtpSettings() {
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  // 465 speaks TLS from the first byte; 587 starts in the clear and upgrades.
  // Port 25 is server-to-server relay and is not an option here.
  const port = Number(process.env.SMTP_PORT || (secure ? 465 : 587));

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new MailConfigError(`SMTP_PORT must be a port number — got "${process.env.SMTP_PORT}".`);
  }
  if (port === 25) {
    throw new MailConfigError("SMTP_PORT 25 is unauthenticated relay — use 587 (STARTTLS) or 465.");
  }
  return { host: requireValue("SMTP_HOST"), port, secure, user: requireValue("SMTP_USER"), pass: requireValue("SMTP_PASS") };
}

// Real delivery needs a real sender. The console and json transports do not —
// nothing leaves the machine — so they fall back to a placeholder rather than
// refusing to boot a development server over a variable that does not matter yet.
const DEV_FROM = "no-reply@techdea.local";

function senderAddress(mode) {
  if (mode === "smtp") return requireAddress("MAIL_FROM");
  return optionalAddress("MAIL_FROM") || DEV_FROM;
}

function build() {
  const mode = resolveMode();
  if (mode === "off") return Object.freeze({ mode, enabled: false });

  return Object.freeze({
    mode,
    enabled: true,
    from: senderAddress(mode),
    fromName: String(process.env.MAIL_FROM_NAME || "TechDea LMS").replace(/[\r\n"]/g, "").trim(),
    replyTo: optionalAddress("MAIL_REPLY_TO"),
    smtp: mode === "smtp" ? smtpSettings() : null,
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
