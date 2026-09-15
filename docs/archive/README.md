# Archive — kept for reference, not built

Nothing in this folder is imported by the client or the server. It is preserved
rather than deleted because it still has historical value, but it is **not** the
source of truth for anything.

## `design-system-source/`

Was the repo-root `styles/` folder. The old README described it as the "original
design-system source (also copied into `client/src/styles`)".

**Flagged for review — these copies are stale.** They have diverged from the
live stylesheets and no build step reads them:

| file | archived copy | live counterpart |
|---|---|---|
| `techdea.css` | 205 lines (5 Sep) | `client/src/styles/design-system.css` — 206 lines |
| `app.css` | 221 lines (6 Sep) | `client/src/styles/app-shell.css` — 337 lines |

The live `app.css` has gained ~116 lines that never made it back here, so this
folder cannot be treated as an upstream to sync from.

**Decide and act:** if the design system is still maintained outside this repo,
re-establish a real sync process and document it. If it is not, delete this
folder — `client/src/styles/` is the only copy that matters.
