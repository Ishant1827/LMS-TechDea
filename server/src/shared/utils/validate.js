// The one check for a person's name and email, used by sign-up, profile edits,
// an admin creating an account and the bulk import — before, only the import
// checked an address at all, and a name sent as a number crashed with a 500.

const NAME_MIN = 2;
const NAME_MAX = 80;
const EMAIL_MAX = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A string from a request body, trimmed. Anything else (a number, an object,
// an array) becomes "" and is then reported as missing rather than crashing.
const cleanText = (v) => (typeof v === "string" ? v.trim() : "");

// Each returns a sentence saying what is wrong, or "" when it is fine.
function nameProblem(name) {
  if (!name) return "Name is required";
  if (name.length < NAME_MIN) return "Name is too short";
  if (name.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer`;
  return "";
}

function emailProblem(email) {
  if (!email) return "Email is required";
  if (email.length > EMAIL_MAX || !EMAIL.test(email)) return "That doesn't look like an email address";
  return "";
}

module.exports = { NAME_MIN, NAME_MAX, EMAIL, cleanText, nameProblem, emailProblem };
