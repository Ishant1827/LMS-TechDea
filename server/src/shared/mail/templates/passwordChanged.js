// Sent after a password actually changes — by reset, or from the profile page.
//
// This is the message nobody asks for and everybody needs. It is the only way a
// person finds out their account was taken over by someone who already had the
// password or a stolen session. Never preference-gated, never batched, and sent
// even when the change was entirely expected: a notification that only arrives
// when something is wrong teaches people nothing, because they have never seen
// the normal one.

const { html } = require("../escape");
const { layout, factPanel, alertNote, C } = require("./_layout");

const SUBJECT = "Your password was changed";

// "18 September 2026 at 14:32" — unambiguous across date conventions, which
// matters when the whole point is "was this you, at that moment?"
function when(date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date instanceof Date ? date : new Date());
}

function render({ name = "", changedAt = new Date() } = {}) {
  const stamp = `${when(changedAt)} UTC`;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const text = [
    greeting,
    "",
    "The password on your TechDea LMS account was changed.",
    "",
    `    When:  ${stamp}`,
    "",
    "You've also been signed out everywhere else, so any other device will need",
    "the new password.",
    "",
    'If this wasn\'t you, use "Forgot password" on the sign-in page to take the',
    "account back straight away — whoever made this change has been signed out too.",
  ].join("\n");

  const body = html`
    <p style="margin:0 0 16px 0;">${greeting}</p>
    <p style="margin:0 0 20px 0;">The password on your TechDea LMS account was changed.</p>

    ${factPanel("When", stamp)}

    <p style="margin:0; font-size:13.5px; color:${C.muted};">
      You've also been signed out everywhere else, so any other device will need the new
      password.
    </p>

    ${alertNote(
      "<strong>If this wasn't you</strong>, use “Forgot password” on the sign-in page to " +
        "take the account back straight away — whoever made this change has been signed out too."
    )}
  `;

  return {
    subject: SUBJECT,
    text,
    html: layout({
      title: SUBJECT,
      body,
      preheader: `Changed ${stamp}. If this wasn't you, act now.`,
    }),
  };
}

module.exports = { render };
