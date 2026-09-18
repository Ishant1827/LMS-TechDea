const mongoose = require("mongoose");
const { OTP_PURPOSES } = require("../../shared/utils/constants");

// One document per (email, purpose), enforced by a unique index.
//
// That shape is doing real work. Issuing a new code overwrites the old one in
// place, so there is never more than one live code for a given purpose — which
// is M7, and it matters: if "resend" left the previous codes valid, three
// resends would triple an attacker's chances on a six-digit number.
//
// It also gives the resend counters somewhere to live that survives a restart.
// The obvious home for them is the rate-limit middleware, but that is in-memory
// and per-instance (G12), so a deploy would reset them — a trivial bypass for a
// counter whose whole job is to be hard to reset.

const otpTokenSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },

    // Null until the code is tied to an account. A code can legitimately exist
    // before we know who it belongs to.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    purpose: { type: String, enum: OTP_PURPOSES, required: true },

    // HMAC-SHA256 of the code, keyed with OTP_PEPPER. The code itself is never
    // stored: a leak of this collection alone yields nothing, because the pepper
    // lives in the environment rather than the database (M2).
    codeHash: { type: String, required: true },

    // When the code stops working (M4). Checked in code — the TTL index below is
    // housekeeping, and Mongo only runs it about once a minute, so it is not an
    // expiry guarantee.
    expiresAt: { type: Date, required: true },

    // Wrong guesses. At MAX_ATTEMPTS the code is destroyed rather than merely
    // throttled (M6) — six digits is one in a million, and unlimited guessing
    // inside the expiry window is genuinely brute-forceable.
    attempts: { type: Number, default: 0 },

    // Resend accounting (M13). The window deliberately outlives the code, which
    // is why purgeAt exists separately below.
    windowStartedAt: { type: Date, default: Date.now },
    sendCount: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },

    // Set atomically on a successful verify, so two concurrent requests cannot
    // both spend the same code (M5).
    consumedAt: { type: Date, default: null },

    // What a spent code is exchanged for (M12). Verifying the code does not by
    // itself change a password — it hands back a short-lived token that the
    // reset endpoint requires. That way the code is never re-transmitted, and
    // the endpoint that actually rotates the password has something it can
    // check rather than trusting the client's word that a code was entered.
    //
    // Hashed for the same reason as the code: this *is* a credential while it
    // lives, and a live one is worth more than an expired six digits.
    actionHash: { type: String, default: null },
    actionExpiresAt: { type: Date, default: null },

    // When the row itself may be deleted. Kept well past expiresAt so that the
    // resend window is not reset by the code expiring — otherwise waiting ten
    // minutes would clear the send count.
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpTokenSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpTokenSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

// A code hash is not as sensitive as a password hash, but there is no reason for
// it to travel: nothing in the API should ever return one of these documents.
otpTokenSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.codeHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("OtpToken", otpTokenSchema);
