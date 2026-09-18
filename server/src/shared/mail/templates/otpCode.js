// The one-time code email.
//
// Deliberately link-free. A code the user types is phishing-resistant in a way a
// "click here to reset" button is not: there is nothing to click, so there is
// nothing to imitate, and we are not training our own users to follow links out
// of emails that claim to be from us.
//
// The plain-text part is the one that matters. It is what a screen reader, a
// terminal client and a spam filter all read, and it must carry the code on its
// own without the HTML.

const { html } = require("../escape");
const { layout, codePanel, alertNote, C } = require("./_layout");

const COPY = {
  email_verify: {
    subject: "Confirm your email address",
    // Shown beside the subject in the inbox list, before the message is opened.
    preheader: "Your TechDea verification code — expires in 10 minutes.",
    lead: "Welcome to TechDea. Use this code to confirm your email address and start learning.",
    // Nobody can lose anything from an unwanted verification email, so the
    // warning stays mild.
    unexpected: "If you didn't create an account, you can ignore this email.",
  },
  password_reset: {
    subject: "Reset your password",
    preheader: "Your TechDea password reset code — expires in 10 minutes.",
    lead: "Use this code to set a new password on your TechDea account.",
    // This one is different: an unrequested reset code means someone typed your
    // address into the forgot-password form, and that is worth knowing about.
    unexpected:
      "<strong>If you didn't ask to reset your password</strong>, you can ignore this email — " +
      "your password hasn't changed. If it keeps happening, change your password.",
  },
  email_change: {
    subject: "Confirm your new email address",
    preheader: "Your TechDea confirmation code — expires in 10 minutes.",
    lead: "Use this code to confirm this address on your TechDea account.",
    unexpected:
      "<strong>If you didn't ask to change your email address</strong>, ignore this email and " +
      "change your password — someone may have access to your account.",
  },
};

// A code is easier to transcribe in two halves than as a six-digit run.
const spaced = (code) => String(code).replace(/^(\d{3})(\d{3})$/, "$1 $2");

// The HTML carries <strong> in a couple of places; the text part should read as
// a sentence, not as markup.
const stripTags = (s) => String(s).replace(/<[^>]+>/g, "");

function render({ code, purpose, expiresMinutes = 10 }) {
  const copy = COPY[purpose];
  if (!copy) throw new Error(`otpCode: unknown purpose "${purpose}"`);

  const display = spaced(code);
  const expiry = `This code expires in ${expiresMinutes} minutes and can be used once.`;
  const caution = "We will never ask you for this code by phone, chat or email.";

  const text = [
    copy.lead,
    "",
    `    ${display}`,
    "",
    expiry,
    caution,
    "",
    stripTags(copy.unexpected),
  ].join("\n");

  const body = html`
    <p style="margin:0 0 20px 0;">${copy.lead}</p>

    ${codePanel(display)}

    <p style="margin:0 0 6px 0; font-size:13.5px; color:${C.muted};">${expiry}</p>
    <p style="margin:0; font-size:13.5px; color:${C.muted};">${caution}</p>

    ${alertNote(copy.unexpected)}
  `;

  return {
    subject: copy.subject,
    text,
    html: layout({ title: copy.subject, body, preheader: copy.preheader }),
  };
}

module.exports = { render, purposes: Object.keys(COPY) };
