const mongoose = require("mongoose");
const { installSafeWrites } = require("../shared/db/safeWrites");

// Registered at module load, before any model file is required, so every schema
// is compiled with the guard already in place. See safeWrites.js for why a
// mis-scoped write has to be an error rather than a silent full-collection
// operation.
installSafeWrites(mongoose);

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set (see server/.env.example)");
  // Unknown keys are stripped from a query filter. Safe for reads; see
  // safeWrites.js for why writes need more than this.
  mongoose.set("strictQuery", true);

  // Without these a database that drops mid-flight shows up only as a wave of
  // failing requests, with nothing in the log saying why.
  mongoose.connection.on("error", (err) => console.error("[mongo] connection error —", err.message));
  mongoose.connection.on("disconnected", () => console.warn("[mongo] disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[mongo] reconnected"));

  await mongoose.connect(uri);
  console.log("MongoDB connected:", mongoose.connection.name);
}

module.exports = connectDB;
