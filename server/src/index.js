require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { logFatal } = require("./shared/utils/logger");
const app = require("./app");

const PORT = process.env.PORT || 5000;

// Without a secret every sign-in fails with a 500 and every token is refused.
// Better to stop here and say why than to start a server that cannot work.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set (see server/.env.example) — refusing to start.");
  process.exit(1);
}
const SHUTDOWN_GRACE_MS = 10_000;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
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
