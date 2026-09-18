// Turns a template id and its data into the three parts an envelope needs.
//
// This is also where the subject line is checked. A subject becomes a mail
// header, and a newline inside one ends the header and starts another — which is
// how a value that reached here unvalidated could add a Bcc. Templates build
// their own subjects today, so this is belt and braces, but it is the right
// place for it to live once a subject ever carries a course name.

const registry = require("./registry");

function render(templateId, data = {}) {
  const entry = registry[templateId];
  if (!entry) throw new Error(`Unknown email template: "${templateId}"`);

  const { subject, text, html } = entry.render(data);

  if (!subject || typeof subject !== "string") {
    throw new Error(`Template "${templateId}" produced no subject.`);
  }
  if (/[\r\n]/.test(subject)) {
    throw new Error(`Template "${templateId}" produced a subject containing a line break.`);
  }
  if (!text || typeof text !== "string") {
    // A message with no plain-text part reads as spam to filters and as nothing
    // at all to a screen reader.
    throw new Error(`Template "${templateId}" produced no plain-text body.`);
  }

  return { subject, text, html: html || "", category: entry.category };
}

module.exports = { render };
