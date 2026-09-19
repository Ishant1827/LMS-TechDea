import { Fragment } from "react";
import { safeUrl } from "@/shared/lib/safeUrl";

/* Reading lessons, written in a small and deliberate subset of Markdown.
 *
 * The important part is what this does *not* do: it never builds an HTML
 * string, and there is no dangerouslySetInnerHTML anywhere in it. Every piece
 * of a lesson becomes a React element, so a teacher's text stays text — the
 * same XSS boundary the plain <div> gave us before, kept while gaining
 * formatting. Links are the one place a teacher's input reaches an attribute,
 * and they go through safeUrl() like every other link in the app (§4.1 of
 * docs/security.md).
 *
 * The subset is small on purpose. It covers what someone writing a lesson
 * actually reaches for, and each rule has to be explainable in one line to a
 * teacher who has never heard the word "markdown":
 *
 *   # ## ###        headings
 *   **bold**        bold
 *   *italic*        italic
 *   `code`          inline code
 *   ```             a block of code, until the next ```
 *   - or *          a bullet list
 *   1.              a numbered list
 *   [text](url)     a link, and a bare https:// link becomes one too
 *   ---             a dividing line
 *   blank line      a new paragraph
 */

/* ── inline ──────────────────────────────────────────────────────────────── */

// A URL may itself contain brackets — Wikipedia's are the everyday example —
// so both link forms allow one level of them. Stopping at the first ")" would
// cut such a link in half and leave the tail sitting in the lesson as text.
const URL_BODY = "(?:[^\\s()]|\\([^\\s()]*\\))+";

// One pass, longest-first so "**bold**" is never read as "*" + "italic".
const INLINE = new RegExp(
  [
    "\\*\\*[^*\\n]+\\*\\*",
    "\\*[^*\\n]+\\*",
    "`[^`\\n]+`",
    `\\[[^\\]\\n]+\\]\\(${URL_BODY}\\)`,
    `https?://${URL_BODY}`,
  ].join("|"),
  "g"
);

// An unusable link stays on the page as the text the teacher typed rather than
// disappearing — they can see what they wrote and fix it.
function link(label, url, key) {
  const href = safeUrl(url);
  if (!href) return label;
  return (
    <a key={key} href={href} target="_blank" rel="noreferrer noopener">
      {label}
    </a>
  );
}

function inline(text, prefix) {
  const out = [];
  let last = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const key = `${prefix}i${m.index}`;
    if (t.startsWith("**")) out.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={key}>{t.slice(1, -1)}</code>);
    else if (t.startsWith("*")) out.push(<em key={key}>{t.slice(1, -1)}</em>);
    else if (t.startsWith("[")) {
      const split = t.indexOf("](");
      out.push(link(t.slice(1, split), t.slice(split + 2, -1), key));
    } else {
      // A bare link at the end of a sentence: the full stop belongs to the
      // sentence, not to the address.
      const url = t.replace(/[.,;:!?]+$/, "");
      out.push(link(url, url, key));
      if (url.length < t.length) out.push(t.slice(url.length));
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ── blocks ──────────────────────────────────────────────────────────────── */

const HEADING = /^(#{1,3})\s+(.+)$/;
const BULLET = /^\s*[-*]\s+(.+)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*```/;

const startsBlock = (l) =>
  HEADING.test(l) || BULLET.test(l) || NUMBERED.test(l) || RULE.test(l) || FENCE.test(l);

function blocks(src) {
  const lines = src.split("\r\n").join("\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // A code block runs to the closing fence, or to the end of the lesson if
    // the teacher forgot one — an unclosed fence should not eat the page.
    if (FENCE.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i += 1;
      out.push(
        <pre key={key}>
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (RULE.test(line)) {
      out.push(<hr key={key} />);
      i += 1;
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      // "#" is the biggest heading a lesson can use, and it sits under the
      // lesson title on the page — so it renders as an h2, not an h1.
      const Tag = `h${Math.min(4, h[1].length + 1)}`;
      out.push(<Tag key={key}>{inline(h[2], key)}</Tag>);
      i += 1;
      continue;
    }

    // A run of bullets, or a run of numbers, is one list.
    const isList = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
    if (isList) {
      const List = isList === BULLET ? "ul" : "ol";
      const items = [];
      while (i < lines.length && isList.test(lines[i])) items.push(lines[i++].match(isList)[1]);
      out.push(
        <List key={key}>
          {items.map((t, n) => (
            <li key={n}>{inline(t, `${key}l${n}`)}</li>
          ))}
        </List>
      );
      continue;
    }

    // Everything else is a paragraph. Single newlines inside it stay as line
    // breaks, because that is what they looked like while being typed.
    const para = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++]);
    out.push(
      <p key={key}>
        {para.map((t, n) => (
          <Fragment key={n}>
            {n > 0 && <br />}
            {inline(t, `${key}p${n}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  return out;
}

export default function Markdown({ text }) {
  return <>{blocks(String(text ?? ""))}</>;
}
