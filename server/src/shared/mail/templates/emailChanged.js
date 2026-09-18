// Sent to the address an account is moving *away from*, at the moment it moves.
//
// This is the one that catches the attack. Someone who has taken over an account
// changes the email to their own, and from then on every code, receipt and
// warning goes to them — the owner would otherwise see nothing at all, and would
// discover it only when they next tried to sign in.
//
// It goes to the old address specifically, which is the only channel the real
// owner still controls by then. Never preference-gated, never skipped.

const { html } = require("../escape");
const { layout, factPanel, alertNote, C } = require("./_layout");

const SUBJECT = "Your email address was changed";

function when(date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date instanceof Date ? date : new Date());
}

// The new address is shown in full and deliberately not linked: the recipient
// needs to recognise it, not visit it.
function render({ name = "", newEmail = "", changedAt = new Date() } = {}) {
  const stamp = `${when(changedAt)} UTC`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const text = [
    greeting,
    "",
    "The email address on your TechDea LMS account was changed.",
    "",
    `    New address:  ${newEmail}`,
    `    When:         ${stamp}`,
    "",
    "This message is going to your previous address, so you can see the change",
    "even though the account no longer uses it.",
    "",
    "If this wasn't you, act now — whoever made this change can reset the",
    'password using the new address. Use "Forgot password" on the sign-in page',
    "immediately, then change the address back.",
  ].join("\n");

  const body = html`
    <p style="margin:0 0 16px 0;">${greeting}</p>
    <p style="margin:0 0 20px 0;">The email address on your TechDea LMS account was changed.</p>

    ${factPanel("New address", newEmail)} ${factPanel("When", stamp)}

    <p style="margin:0; font-size:13.5px; color:${C.muted};">
      This message is going to your previous address, so you can see the change even though the
      account no longer uses it.
    </p>

    ${alertNote(
      "<strong>If this wasn't you, act now.</strong> Whoever made this change can reset the " +
        "password using the new address. Use “Forgot password” on the sign-in page " +
        "immediately, then change the address back."
    )}
  `;

  return {
    subject: SUBJECT,
    text,
    html: layout({
      title: SUBJECT,
      body,
      preheader: `Your account now uses ${newEmail}. If this wasn't you, act now.`,
    }),
  };
}

module.exports = { render };
