// Exercises the mail path end to end without starting the API.
//
//   npm run mail:smoke                      -> renders every OTP purpose
//   npm run mail:smoke -- you@example.com   -> and sends them, if SMTP is configured
//   npm run mail:smoke -- --html            -> also dumps the rendered HTML
//
// It deliberately goes through notify() rather than calling the mailer, so what
// is proven here is the same path a controller will use.

require("dotenv").config();

const { assertMailConfig, mailConfig } = require("../src/shared/mail/config");
const { verifyTransport, closeTransport } = require("../src/shared/mail/transport");
const { render } = require("../src/shared/mail/render");
const { notify } = require("../src/modules/notifications/notify");
const { OTP_PURPOSES } = require("../src/shared/utils/constants");

const args = process.argv.slice(2);
const wantHtml = args.includes("--html");
const recipient = args.find((a) => a.includes("@")) || "smoke-test@example.com";

async function main() {
  assertMailConfig();
  const cfg = mailConfig();

  if (!cfg.enabled) {
    console.error("\nMail is disabled — set MAIL_TRANSPORT in server/.env (console is fine).\n");
    process.exit(1);
  }

  if (cfg.mode === "smtp") {
    const { ok, reason } = await verifyTransport();
    console.log(ok ? "[mail] SMTP connection verified." : `[mail] SMTP check failed — ${reason}`);
    if (!ok) process.exit(1);
  }

  // A fixed, obviously-fake code: this script should never print something a
  // reader could mistake for a live one.
  const code = "000000";

  for (const purpose of OTP_PURPOSES) {
    const { subject, html } = render("otpCode", { code, purpose });
    console.log(`\n=== ${purpose} — "${subject}" ===`);

    const { sent } = await notify("auth.otp.requested", { email: recipient, code, purpose });
    if (!sent) {
      console.error(`FAILED: ${purpose}`);
      process.exitCode = 1;
    }
    if (wantHtml) console.log(html);
  }

  closeTransport();
  console.log(`\nDone — ${cfg.mode} transport, recipient ${recipient}.\n`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
