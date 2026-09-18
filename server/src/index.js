require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { logFatal } = require("./shared/utils/logger");
const { assertMailConfig, mailEnabled } = require("./shared/mail/config");
const { verifyTransport, closeTransport } = require("./shared/mail/transport");
const { assertOtpConfig } = require("./modules/auth/otp.service");
const app = require("./app");

const PORT = process.env.PORT || 5000;
const SHUTDOWN_GRACE_MS = 10_000;

// Mail configuration is validated before anything else starts. A bad SMTP
// setting must be a failed boot with a readable reason, not a surprise on the
// first password reset someone genuinely needs.
try {
  assertMailConfig();
  // One-time codes only exist to be emailed, so with mail off the pepper is not
  // needed and demanding it would be a variable to set for a feature that is
  // switched off.
  if (mailEnabled()) assertOtpConfig();
} catch (err) {
  console.error(`Configuration is invalid: ${err.message}`);
  process.exit(1);
}

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
    // Proves the credentials and the TLS handshake now rather than later. Mail
    // being unreachable is not a reason to stop serving courses, so this only
    // reports.
    verifyTransport().then(({ ok, reason }) => {
      if (!ok && reason !== "mail is disabled") console.warn(`[mail] transport check failed — ${reason}`);
    });
    installShutdown(server);
  })
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    console.error("Is MongoDB running, and is MONGO_URI correct in server/.env?");
    process.exit(1);
  });

// Render sends SIGTERM on every redeploy. Without this the process dies mid
// request and a write in flight is simply lost.
function installShutdown(server) {
  let closing = false;

  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received — finishing in-flight requests…`);

    const force = setTimeout(() => {
      console.error("Grace period elapsed; exiting anyway.");
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();

    server.close(async () => {
      clearTimeout(force);
      closeTransport();
      try {
        await mongoose.connection.close(false);
      } catch (e) {
        logFatal("closing MongoDB connection", e);
      }
      console.log("Shutdown complete.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // A rejection nobody caught is a bug, but it is not a reason to drop every
  // other user's request — log it and keep serving.
  process.on("unhandledRejection", (reason) => {
    logFatal("unhandled promise rejection", reason instanceof Error ? reason : new Error(String(reason)));
  });

  // An uncaught exception leaves the process in an unknown state, so this one
  // does exit — Render restarts it.
  process.on("uncaughtException", (err) => {
    logFatal("uncaught exception", err);
    shutdown("uncaughtException");
    setTimeout(() => process.exit(1), 1000).unref();
  });
}
