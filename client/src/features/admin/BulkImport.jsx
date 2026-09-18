import { useRef, useState } from "react";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import api from "@/shared/api/client";
import { useToast } from "@/shared/context/ToastContext";

/**
 * Adding students and teachers from a spreadsheet.
 *
 * The file never leaves the browser. It is read here, parsed here and sent as
 * ordinary JSON, so the server has no upload to handle — no multipart body,
 * nothing written to disk, no parser of somebody else's file format running
 * where it could be attacked. That keeps D10 ("no file uploads") intact rather
 * than carving an exception into it.
 *
 * It also makes the preview possible: every row is checked and shown before a
 * single account is created, so a malformed spreadsheet is a thing you fix
 * rather than a half-finished import you have to unpick.
 */

// The server refuses more than 50 per request, and hashing a password costs
// about 150ms — so large imports go up in pieces, with the progress visible
// rather than a spinner that looks like it has hung.
const CHUNK = 25;

const NAME_MIN = 2;
const NAME_MAX = 80;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["student", "teacher"];

/**
 * A CSV parser that handles the things Excel actually produces: quoted fields,
 * commas and newlines inside quotes, and doubled quotes as an escape. Splitting
 * on commas would mangle "Patel, Asha" on the first row somebody pastes in.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // "" is a literal quote
        else quoted = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

// Excel writes a UTF-8 byte-order mark, which would otherwise become part of
// the first header and stop "name" matching.
const stripBom = (s) => s.replace(/^﻿/, "");

const HEADERS = {
  name: ["name", "full name", "fullname", "student name", "teacher name"],
  email: ["email", "e-mail", "email address", "mail"],
  role: ["role", "type", "user type"],
};

function mapHeaders(headerRow) {
  const cleaned = headerRow.map((h) => h.trim().toLowerCase());
  const find = (key) => cleaned.findIndex((h) => HEADERS[key].includes(h));
  return { name: find("name"), email: find("email"), role: find("role") };
}

// Mirrors the server's rules so the preview tells the truth. The server checks
// again regardless — this is for the person looking at the screen, not a
// substitute for validation (R1).
function checkRow({ name, email, role }) {
  if (!name) return "name is missing";
  if (name.length < NAME_MIN) return "name is too short";
  if (name.length > NAME_MAX) return `name is longer than ${NAME_MAX} characters`;
  if (!email) return "email is missing";
  if (!EMAIL.test(email)) return "email is not a valid address";
  if (!ROLES.includes(role)) return "role must be student or teacher";
  return "";
}

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Quote anything that could otherwise break the file open again.
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n");

export default function BulkImport({ onImported }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]); // { line, name, email, role, error }
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null); // { created, skipped }

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  const reset = () => {
    setFileName(""); setRows([]); setErr(""); setResult(null); setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setResult(null); setProgress(null);

    const text = stripBom(await file.text());
    const table = parseCsv(text);

    if (table.length < 2) {
      setRows([]); setFileName(file.name);
      return setErr("That file has a header row but no people in it.");
    }

    const cols = mapHeaders(table[0]);
    if (cols.name === -1 || cols.email === -1) {
      setRows([]); setFileName(file.name);
      return setErr("Couldn't find a 'name' and an 'email' column. Download the template below to see the format.");
    }

    const parsed = table.slice(1).map((r, i) => {
      const name = (r[cols.name] ?? "").trim();
      const email = (r[cols.email] ?? "").trim().toLowerCase();
      const role = ((cols.role === -1 ? "" : r[cols.role]) ?? "").trim().toLowerCase() || "student";
      return { line: i + 2, name, email, role, error: checkRow({ name, email, role }) };
    });

    // A duplicate inside the file would create the first and fail the second on
    // the unique index, which reads as a random failure. Better to say so here.
    const seen = new Set();
    for (const r of parsed) {
      if (r.error) continue;
      if (seen.has(r.email)) r.error = "this email appears earlier in the file";
      else seen.add(r.email);
    }

    setFileName(file.name);
    setRows(parsed);
  };

  const run = async () => {
    setErr(""); setBusy(true);
    setProgress({ done: 0, total: valid.length });

    const created = [];
    const skipped = [];

    try {
      for (let i = 0; i < valid.length; i += CHUNK) {
        const slice = valid.slice(i, i + CHUNK);
        const { data } = await api.post("/users/bulk", {
          people: slice.map(({ name, email, role }) => ({ name, email, role })),
        });
        created.push(...data.created);
        // The server counts within its own chunk; map it back to the line the
        // person is looking at in their spreadsheet.
        skipped.push(...data.skipped.map((s) => ({ ...s, line: slice[s.index]?.line ?? "?" })));
        setProgress({ done: Math.min(i + CHUNK, valid.length), total: valid.length });
      }

      setResult({ created, skipped });
      setRows([]);
      if (fileRef.current) fileRef.current.value = "";
      toast(`Created ${created.length} ${created.length === 1 ? "account" : "accounts"}`);
      onImported?.();
    } catch (e) {
      // Whatever was created before the failure still exists, and the accounts
      // already made are in `created` — say so rather than implying nothing
      // happened.
      setErr(
        created.length
          ? `${e.message} — ${created.length} account(s) were created before this failed.`
          : e.message
      );
      if (created.length) setResult({ created, skipped });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadTemplate = () =>
    download("techdea-import-template.csv", toCsv([
      ["name", "email", "role"],
      ["Asha Patel", "asha.patel@example.com", "student"],
      ["Ravi Kumar", "ravi.kumar@example.com", "teacher"],
      ["Priya Singh", "priya.singh@example.com", ""],
    ]));

  const downloadPasswords = () =>
    download(
      `techdea-passwords-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([["name", "email", "role", "password"],
        ...result.created.map((c) => [c.name, c.email, c.role, c.password])])
    );

  return (
    <div className="card elev-sm" style={{ marginBottom: 20 }}>
      <div className="card-kicker">Import from a spreadsheet</div>

      {err && <div className="form-error">{err}</div>}

      {/* ── results ──────────────────────────────────────────────────── */}
      {result ? (
        <>
          <div className="form-note">
            Created <strong>{result.created.length}</strong>
            {result.skipped.length > 0 && <> · skipped <strong>{result.skipped.length}</strong></>}.
            {result.created.length > 0 && (
              <> These passwords are shown <strong>once</strong> — download them now, or you'll need to
              set new ones from the list below.</>
            )}
          </div>

          {result.created.length > 0 && (
            <>
              <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
                <table className="table">
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Password</th></tr>
                  </thead>
                  <tbody>
                    {result.created.map((c) => (
                      <tr key={c.email}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td className="text-muted">{c.email}</td>
                        <td>{c.role}</td>
                        <td style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>{c.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={downloadPasswords}>
                  <Download /> Download passwords
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset}>Import another file</button>
              </div>
            </>
          )}

          {result.skipped.length > 0 && (
            <>
              <div className="muted-sm" style={{ marginTop: 12, marginBottom: 6 }}>Not imported:</div>
              <ul className="muted-sm" style={{ margin: 0, paddingLeft: 18 }}>
                {result.skipped.map((s, i) => (
                  <li key={i}>Row {s.line}: {s.email || "(no email)"} — {s.reason}</li>
                ))}
              </ul>
            </>
          )}

          {result.created.length === 0 && (
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={reset}>Try another file</button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── pick a file ────────────────────────────────────────── */}
          <p className="text-muted" style={{ marginTop: 0 }}>
            A CSV with <strong>name</strong>, <strong>email</strong> and an optional{" "}
            <strong>role</strong> column (student or teacher — blank means student). Everyone gets a
            generated password you'll see once. Admins are added one at a time, above.
          </p>

          <div className="form-actions" style={{ marginBottom: rows.length ? 14 : 0 }}>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
              <Upload /> Choose CSV file
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                style={{ display: "none" }}
              />
            </label>
            <button type="button" className="btn btn-ghost" onClick={downloadTemplate}>
              <FileSpreadsheet /> Download template
            </button>
            {fileName && <span className="muted-sm">{fileName}</span>}
          </div>

          {/* ── preview ────────────────────────────────────────────── */}
          {rows.length > 0 && (
            <>
              <div className="muted-sm" style={{ marginBottom: 8 }}>
                {valid.length} ready to import
                {invalid.length > 0 && <> · {invalid.length} with problems, which will be left out</>}
              </div>

              <div className="table-wrap" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="table">
                  <thead>
                    <tr><th>Row</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.line} style={r.error ? { opacity: 0.65 } : undefined}>
                        <td className="text-muted">{r.line}</td>
                        <td style={{ fontWeight: 600 }}>{r.name || <span className="text-muted">—</span>}</td>
                        <td className="text-muted">{r.email || "—"}</td>
                        <td>{r.role}</td>
                        <td>
                          {r.error ? (
                            <span style={{ color: "var(--color-danger)" }}>{r.error}</span>
                          ) : (
                            <span className="tag tag-accent">ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className={"btn btn-primary" + (busy ? " is-loading" : "")}
                  disabled={busy || valid.length === 0}
                  onClick={run}
                >
                  {progress
                    ? `Importing ${progress.done} of ${progress.total}…`
                    : `Import ${valid.length} ${valid.length === 1 ? "person" : "people"}`}
                </button>
                <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
