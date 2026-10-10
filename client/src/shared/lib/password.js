// Mirror of server/src/shared/utils/password.js, so a form can say what is wrong
// before it submits. The server's copy is the one that counts — keep the two in
// step.

export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

const MIN = 8;
const MAX_BYTES = 72;

const COMMON = new Set([
  "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword1",
  "12345678a", "1234567a", "a1234567", "abc12345", "abcd1234", "qwerty123",
  "qwerty12", "1q2w3e4r", "1qaz2wsx", "iloveyou1", "welcome1", "welcome123",
  "letmein1", "admin123", "admin1234", "student1", "student123", "teacher1",
  "teacher123", "techdea1", "techdea123",
]);

// Returns a sentence saying what is wrong, or "" when the password is fine.
export function passwordProblem(raw, { name = "", email = "" } = {}) {
  const pw = String(raw ?? "");
  if (pw.length < MIN) return `At least ${MIN} characters`;
  if (new TextEncoder().encode(pw).length > MAX_BYTES) return "Too long — keep it under 72 characters";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Needs at least one letter and one number";

  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return "Too common — pick something less guessable";

  const local = String(email).toLowerCase().split("@")[0];
  if (local.length >= 3 && lower.includes(local)) return "Can't contain your email address";
  const first = String(name).trim().toLowerCase().split(/\s+/)[0] || "";
  if (first.length >= 3 && lower.replace(/\d+/g, "") === first) return "Can't be just your name and a number";
  return "";
}
