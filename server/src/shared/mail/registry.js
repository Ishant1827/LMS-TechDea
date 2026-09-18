// Every template this application can send, and the category it belongs to.
//
// The category is declared here rather than at the call site so it cannot be
// forgotten or argued with (R15). Nothing reads it yet — preferences and
// unsubscribe arrive in a later phase — but retrofitting a category onto twenty
// existing templates is a migration, and declaring it now costs one line.

const { MAIL_CATEGORIES } = require("../utils/constants");
const otpCode = require("./templates/otpCode");
const passwordChanged = require("./templates/passwordChanged");
const emailChanged = require("./templates/emailChanged");

const registry = {
  otpCode: { category: "security", render: otpCode.render },
  passwordChanged: { category: "security", render: passwordChanged.render },
  emailChanged: { category: "security", render: emailChanged.render },
};

// A typo in a category would quietly opt a security email into a preference
// check later on, so it is caught at require time instead.
for (const [id, entry] of Object.entries(registry)) {
  if (!MAIL_CATEGORIES.includes(entry.category)) {
    throw new Error(`Mail template "${id}" has an unknown category "${entry.category}".`);
  }
  if (typeof entry.render !== "function") {
    throw new Error(`Mail template "${id}" has no render function.`);
  }
}

module.exports = registry;
