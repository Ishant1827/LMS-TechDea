// The HTML half of an email is a render sink like any other, and the content
// reaching it is not always ours: a course title, a student's name, a doubt's
// subject. R4 says user content is never rendered as HTML — this is how that
// rule is kept on the far side of an SMTP connection.
//
// The `html` tagged template escapes every interpolated value, so escaping is
// the default and skipping it takes deliberate effort:
//
//   html`<p>Hello ${user.name}</p>`     // name is escaped
//
// Static markup written in the literal itself passes through untouched, which is
// the point — that part is ours.

const ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ENTITIES[ch]);
}

// Occasionally a template composes markup it built itself — a list of rows, say.
// Wrapping it says "already escaped, leave it alone". Nothing user-authored may
// reach `raw` without having gone through `html` first.
class SafeHtml {
  constructor(value) {
    this.value = String(value);
  }
  toString() {
    return this.value;
  }
}

const raw = (value) => new SafeHtml(value);

const escapeValue = (v) => (v instanceof SafeHtml ? v.toString() : escapeHtml(v));

function html(strings, ...values) {
  return strings.reduce(
    (out, chunk, i) => out + chunk + (i < values.length ? escapeValue(values[i]) : ""),
    ""
  );
}

module.exports = { escapeHtml, html, raw, SafeHtml };
