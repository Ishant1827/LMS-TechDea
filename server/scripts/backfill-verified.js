// One-off: mark every account that existed before email verification shipped as
// verified.
//
// Without this, the soft gate applies retroactively — every student already on
// the system would be told to confirm an address using a code that was never
// sent, and enrolment would stop working for all of them at once. They predate
// the requirement, so they are grandfathered rather than punished for our
// timing.
//
// Safe to run more than once: it only touches accounts with no verification date.
//
//   node scripts/backfill-verified.js

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/modules/users/User.model");

(async () => {
  await connectDB();

  const pending = await User.countDocuments({
    $or: [{ emailVerifiedAt: null }, { emailVerifiedAt: { $exists: false } }],
  });

  if (!pending) {
    console.log("Nothing to do — every account already has a verification date.");
  } else {
    // Stamped with the account's own creation time rather than "now", so the
    // field keeps meaning "this address was accepted as of…" instead of
    // recording a migration that had nothing to do with the user.
    const users = await User.find({
      $or: [{ emailVerifiedAt: null }, { emailVerifiedAt: { $exists: false } }],
    }).select("_id createdAt");

    const ops = users.map((u) => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { emailVerifiedAt: u.createdAt || new Date() } },
      },
    }));

    const result = await User.bulkWrite(ops);
    console.log(`Grandfathered ${result.modifiedCount} existing account(s).`);
  }

  await mongoose.connection.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
