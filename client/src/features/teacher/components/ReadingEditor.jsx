import { useState } from "react";
import Markdown from "@/shared/lib/markdown";

/* The reading-lesson box.
 *
 * A teacher writing a lesson is writing continuously, so nothing here asks them
 * to stop and click something to format a word. They type; the few symbols that
 * mean something are listed right under the box in the words a teacher uses,
 * not the words a programmer uses; and Preview shows the real student page, so
 * nobody has to trust the instructions — they can just look.
 *
 * Everything the teacher types stays text. See lib/markdown.jsx for why that
 * matters and how it is kept true.
 */

// "Type this" is shown exactly as typed; "You get" is rendered by the same
// component the student's page uses, so this table can never drift from the
// real behaviour.
const GUIDE = [
  ["# Chapter 1", "A big heading"],
  ["## Part 1", "A smaller heading"],
  ["**important**", "**important** — in bold"],
  ["*a note*", "*a note* — in italics"],
  ["- first point", "A bullet point"],
  ["1. first step", "A numbered step"],
  ["[TechDea](https://techdea.in)", "[TechDea](https://techdea.in) — a clickable link"],
];

export default function ReadingEditor({
  value,
  onChange,
  label = "Reading text / post",
  placeholder = "Write the lesson here.\n\nLeave a blank line between paragraphs.",
  minHeight = 220,
}) {
  const [preview, setPreview] = useState(false);
  const text = value || "";

  return (
    <div className="field">
      <div className="rt-head">
        <label>{label}</label>
        <div className="rt-tabs">
          <button
            type="button"
            className={"rt-tab" + (preview ? "" : " is-on")}
            onClick={() => setPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            className={"rt-tab" + (preview ? " is-on" : "")}
            onClick={() => setPreview(true)}
          >
            Preview
          </button>
        </div>
      </div>

      {preview ? (
        <div className="reading-body rt-preview">
          {text.trim() ? (
            <Markdown text={text} />
          ) : (
            <p className="muted-sm">Nothing written yet — switch to Write and start typing.</p>
          )}
        </div>
      ) : (
        <textarea
          className="input"
          style={{ minHeight }}
          value={text}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}

      <p className="rt-tip">
        Just type normally. A blank line starts a new paragraph. A few symbols add
        formatting — <strong>Preview</strong> shows exactly what your students will see.
      </p>

      <details className="rt-help">
        <summary>How to add headings, bold text and lists</summary>
        <table className="rt-guide">
          <thead>
            <tr>
              <th>Type this</th>
              <th>Students see</th>
            </tr>
          </thead>
          <tbody>
            {GUIDE.map(([src, out]) => (
              <tr key={src}>
                <td>
                  <code>{src}</code>
                </td>
                <td>
                  <Markdown text={out} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted-sm">
          Put each bullet or numbered step on its own line. Pasting a web address on its
          own makes it clickable by itself. Anything else you type stays exactly as you
          typed it.
        </p>
      </details>
    </div>
  );
}
