# Email — removed

The email feature was built and then removed on 2026-09-18. This file is kept as
a pointer rather than a design, because the design is no longer true of the code.

**Why it went.** It could not work where this is deployed, on two independent
counts. Render's free plan blocks outbound traffic to the SMTP ports (25, 465,
587), so nothing could leave the server. And a free mail domain — gmail.com and
the like — cannot be authenticated by anyone, so even over an HTTP email API the
sender would be rewritten or refused, and what did arrive would land in spam.
Both needed a domain the project does not have.

**What was built, and where it is.** A full mail layer (provider-agnostic
transport, template registry, escaping boundary, `notify()` seam), one-time
codes (hashed, purpose-bound, attempt-capped, single-use), signup verification
with a soft gate, password reset by code, and a verified email-change flow that
notified the old address. All of it is in git history — see the commits between
`Add email, one-time codes, and verified account recovery` and
`Remove the email feature entirely`.

**What replaced it.** Nothing sends anything. Password recovery is an admin
setting a new password from Admin › Users, which ends every session on that
account and forces its owner to choose their own password on the way back in.
That is recorded as G24, G5 and G7 in `security.md`, with the consequences
spelled out rather than implied.

**If email comes back**, the order is: a domain first, then an HTTP email API
(the ports stay blocked regardless), then restore the layer from history. The
seam it was built around — feature code calling `notify(event, payload)` and
nothing else — is the part worth keeping if it is rebuilt.
