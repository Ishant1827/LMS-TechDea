// Issuing and checking one-time codes. No HTTP here, and no knowledge of email —
// the caller decides what to do with a code, and notify() decides how it travels.

const crypto = require("crypto");
const OtpToken = require("./OtpToken.model");

const CODE_TTL_MS = 10 * 60 * 1000; // M4
const PURGE_AFTER_MS = 60 * 60 * 1000; // outlives the resend window, see the model
const MAX_ATTEMPTS = 5; // M6
const RESEND_COOLDOWN_MS = 60 * 1000; // M13
const RESEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;
const ACTION_TTL_MS = 5 * 60 * 1000; // M12 — long enough to type a password, no longer

// Mirrors A4: no development fallback, and no pepper means no codes rather than
// weak codes. Called at boot so this surfaces on deploy, not on first signup.
function assertOtpConfig() {
  const pepper = process.env.OTP_PEPPER || "";
  if (pepper.length < 32) {
    throw new Error(
      "OTP_PEPPER must be set to at least 32 characters. Generate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }
}

// crypto.randomInt is the CSPRNG. Math.random is seeded state that can be
// recovered from previous outputs, which for a login credential is disqualifying.
const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

// Keyed, not plain: the key is in the environment, so the database on its own is
// not enough to test a guess offline (M2). HMAC rather than bcrypt because the
// pepper already removes the offline attack this would slow down, and verify runs
// on a request path.
function hashCode(code) {
  assertOtpConfig();
  return crypto.createHmac("sha256", process.env.OTP_PEPPER).update(String(code)).digest("hex");
}

function sameHash(a, b) {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself be an oracle.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const normalise = (email) => String(email || "").toLowerCase().trim();

function tooSoon(retryAfterSec) {
  const err = new Error(
    `Please wait ${retryAfterSec} seconds before asking for another code.`
  );
  err.status = 429;
  err.retryAfter = retryAfterSec;
  return err;
}

function tooMany(retryAfterSec) {
  const err = new Error("Too many codes requested. Try again in a little while.");
  err.status = 429;
  err.retryAfter = retryAfterSec;
  return err;
}

/**
 * Mint a code for (email, purpose), replacing any previous one.
 *
 * Throws a 429 when the caller is asking too often. That error is for the
 * *authenticated or self-evident* case — the public endpoints must not let it
 * reach the client, because "you are asking too often about this address" tells
 * an enumerator the address exists.
 *
 * @returns {Promise<{ code: string, expiresMinutes: number }>}
 */
async function issue({ email, purpose, userId = null }) {
  assertOtpConfig();
  const to = normalise(email);
  const now = Date.now();

  const existing = await OtpToken.findOne({ email: to, purpose });

  let windowStartedAt = new Date(now);
  let sendCount = 0;

  if (existing) {
    const windowOpen = now - existing.windowStartedAt.getTime() < RESEND_WINDOW_MS;
    if (windowOpen) {
      const sinceLast = now - existing.lastSentAt.getTime();
      if (sinceLast < RESEND_COOLDOWN_MS) {
        throw tooSoon(Math.ceil((RESEND_COOLDOWN_MS - sinceLast) / 1000));
      }
      if (existing.sendCount >= MAX_SENDS_PER_WINDOW) {
        const left = RESEND_WINDOW_MS - (now - existing.windowStartedAt.getTime());
        throw tooMany(Math.ceil(left / 1000));
      }
      windowStartedAt = existing.windowStartedAt;
      sendCount = existing.sendCount;
    }
  }

  const code = generateCode();

  // Upsert rather than insert: one row per (email, purpose) is what makes a new
  // code invalidate the old one without a separate cleanup step (M7). attempts
  // resets to zero because this is a different secret.
  await OtpToken.findOneAndUpdate(
    { email: to, purpose },
    {
      $set: {
        email: to,
        purpose,
        userId,
        codeHash: hashCode(code),
        expiresAt: new Date(now + CODE_TTL_MS),
        purgeAt: new Date(now + PURGE_AFTER_MS),
        attempts: 0,
        consumedAt: null,
        windowStartedAt,
        sendCount: sendCount + 1,
        lastSentAt: new Date(now),
      },
    },
    { upsert: true, new: true }
  );

  return { code, expiresMinutes: Math.round(CODE_TTL_MS / 60000) };
}

/**
 * Spend a code. Single-use, and a wrong guess costs an attempt.
 *
 * Every failure returns the same shape and the caller should render the same
 * message: distinguishing "expired" from "wrong" from "no such code" gives an
 * attacker a map of which addresses have a pending code.
 *
 * @returns {Promise<{ ok: boolean, userId?: ObjectId|null, reason?: string }>}
 */
async function verify({ email, purpose, code }) {
  assertOtpConfig();
  const to = normalise(email);
  const supplied = String(code || "").trim();

  // Shape-check before touching the database: a six-digit string is the only
  // thing that can ever match, so anything else is not worth an attempt slot.
  if (!/^\d{6}$/.test(supplied)) return { ok: false, reason: "malformed" };

  const token = await OtpToken.findOne({ email: to, purpose });
  if (!token) return { ok: false, reason: "none" };
  if (token.consumedAt) return { ok: false, reason: "used" };
  if (token.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (token.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  if (!sameHash(hashCode(supplied), token.codeHash)) {
    const updated = await OtpToken.findOneAndUpdate(
      { _id: token._id },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    // Burn the code outright once the budget is gone, rather than leaving it
    // guessable for the rest of its ten minutes (M6).
    if (updated && updated.attempts >= MAX_ATTEMPTS) {
      await OtpToken.updateOne({ _id: token._id }, { $set: { expiresAt: new Date() } });
    }
    return { ok: false, reason: "mismatch" };
  }

  // The match is not enough on its own — two requests carrying the same correct
  // code can arrive together. Only the one that wins this conditional update has
  // actually spent it (M5).
  const spent = await OtpToken.findOneAndUpdate(
    { _id: token._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );
  if (!spent) return { ok: false, reason: "used" };

  return { ok: true, userId: spent.userId };
}

/**
 * Exchange a just-verified code for a short-lived token that authorises one
 * specific action. Called immediately after verify() returns ok.
 *
 * 32 random bytes rather than a signed JWT: a JWT would be stateless, and
 * stateless is the one thing this must not be — it has to be spendable exactly
 * once, which needs somewhere to record that it was spent.
 */
async function issueActionToken({ email, purpose }) {
  assertOtpConfig();
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();

  const updated = await OtpToken.findOneAndUpdate(
    { email: normalise(email), purpose },
    { $set: { actionHash: hashCode(token), actionExpiresAt: new Date(now + ACTION_TTL_MS) } },
    { new: true }
  );
  if (!updated) throw new Error("issueActionToken: no token row for that email and purpose");

  return { actionToken: token, expiresMinutes: Math.round(ACTION_TTL_MS / 60000) };
}

/**
 * Spend an action token. Single use: the row is removed on success, so a replay
 * finds nothing. Returns the same uninformative shape on every failure.
 */
async function consumeActionToken({ email, purpose, actionToken }) {
  assertOtpConfig();
  const supplied = String(actionToken || "");
  if (!supplied) return { ok: false };

  const row = await OtpToken.findOne({ email: normalise(email), purpose });
  if (!row || !row.actionHash || !row.actionExpiresAt) return { ok: false };
  if (row.actionExpiresAt.getTime() <= Date.now()) return { ok: false };
  if (!sameHash(hashCode(supplied), row.actionHash)) return { ok: false };

  // Delete rather than flag: nothing further is owed to this flow, and a row
  // that no longer exists cannot be replayed however the rest of this request
  // goes.
  const gone = await OtpToken.findOneAndDelete({ _id: row._id, actionHash: row.actionHash });
  if (!gone) return { ok: false }; // lost a race with a concurrent spend

  return { ok: true, userId: row.userId };
}

// Used when a flow ends and any outstanding code should stop working — after a
// password reset, or when an email change is abandoned.
async function invalidate({ email, purpose }) {
  await OtpToken.deleteOne({ email: normalise(email), purpose });
}

module.exports = {
  issue,
  verify,
  issueActionToken,
  consumeActionToken,
  invalidate,
  assertOtpConfig,
  // exported for tests
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  MAX_SENDS_PER_WINDOW,
  ACTION_TTL_MS,
};
