// The one password rule, used by every route that accepts a password a person
// chose or typed: signup, change password, and an admin creating an account or
// setting one. (Imported passwords are generated, not chosen, and are replaced
// on first sign-in — A12 — so they are not held to it.)
//
// Mirrored in client/src/shared/lib/password.js so a form can say what is wrong
// before it submits. This copy is the one that counts.

const MIN = 8;
// bcrypt only reads the first 72 bytes. Anything past that would be silently
// ignored, so a long passphrase would be weaker than its owner believes.
const MAX_BYTES = 72;

// The handful that pass the shape rules below and still top every leaked list.
// Not a breach check — a cheap floor under the most obvious choices.
const COMMON = new Set([
  "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword1",
  "12345678a", "1234567a", "a1234567", "abc12345", "abcd1234", "qwerty123",
  "qwerty12", "1q2w3e4r", "1qaz2wsx", "iloveyou1", "welcome1", "welcome123",
  "letmein1", "admin123", "admin1234", "student1", "student123", "teacher1",
  "teacher123", "techdea1", "techdea123",
]);

// Returns a sentence saying what is wrong, or "" when the password is fine.
function passwordProblem(raw, { name = "", email = "" } = {}) {
  const pw = String(raw ?? "");
  if (pw.length < MIN) return `Password must be at least ${MIN} characters`;
  if (Buffer.byteLength(pw, "utf8") > MAX_BYTES) return "Password is too long — keep it under 72 characters";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password needs at least one letter and one number";

  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common — pick something less guessable";

  const local = String(email).toLowerCase().split("@")[0];
  if (local.length >= 3 && lower.includes(local)) return "Password can't contain your email address";
  const first = String(name).trim().toLowerCase().split(/\s+/)[0] || "";
  if (first.length >= 3 && lower.replace(/\d+/g, "") === first) {
    return "Password can't be just your name and a number";
  }
  return "";
}

module.exports = { passwordProblem };
