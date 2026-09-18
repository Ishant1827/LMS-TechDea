# Email Architecture — TechDea LMS

**Design reference for the email subsystem.** Companion to `security.md`, which remains the
security baseline; anything here that becomes a security control moves *there* once it is in
the code and verified.

Status: **Phases 0 and 1 complete** — signup verification, password reset, `tokenVersion`
revocation and verified email change are all live and recorded in `security.md` §4b and §4c.
Phases 2–4 are design only.
Written: **2026-09-18**
Branch at time of writing: `refactor/feature-based-structure`

The immediate requirement is OTP email. The design below is deliberately wider than that,
because the expensive mistake is not "we picked the wrong SMTP host" — it is "every controller
calls `sendMail` directly, so adding preferences means touching forty call sites." Sections 2
and 10 exist to prevent that.

---

## 0. Agreed scope

| Decision | Outcome | Rationale |
|---|---|---|
| **OTP covers** | Signup email verification, password reset, **and email change** | The first two close `G7` and `G5`. The third closes the takeover chain in §8.4 |
| **Passwordless login** | Deferred | Six digits as a permanent auth factor is a much heavier decision. The `purpose` field (`M3`) makes it a new enum value later, not a new subsystem |
| **Unverified accounts** | **Soft gate** — may sign in and browse; may not enroll, submit, or post doubts | A hard gate turns one undelivered email into a fully blocked user, and delivery is not yet proven |
| **Sending** | Gmail app password on a dedicated account | No domain owned yet, so SPF/DKIM/DMARC alignment is unavailable. §7 records the ceiling this imposes and when it must change |
| **Session revocation** | `tokenVersion` ships **with** this feature | A reset that leaves a stolen 7-day JWT alive is theatre. Closes most of `G2` |

---

## 1. Why this touches security.md

Three gaps in the baseline are closed or narrowed by this work:

- **`G5`** — no password reset. `ForgotPassword.jsx` currently tells users to ask an admin, and
  no such endpoint exists. A locked-out user is permanently locked out.
- **`G7`** — no email verification. Any address can be registered without proving control of it.
- **`G2`** — no token revocation (narrowed, not closed: logout stays client-side).

And one is opened, then closed within the same work: making email a **recovery channel** turns
the unverified email change in `auth.controller.js` `updateMe` from a minor gap into an account
takeover primitive. See §8.4.

---

## 2. Architecture

Five layers. The governing rule is that **feature code never knows an SMTP server exists.**

```
controller / service
        |  notify("auth.otp.requested", { userId, purpose, code })
        v
+-----------------------------------------------+
| 5. Dispatcher                                 |  what to send, to whom, may we
|    - resolves recipients                      |
|    - checks category against user preference  |
|    - applies the idempotency key              |
+---------------+-------------------------------+
                v
+-----------------------------------------------+
| 4. Outbox (Mongo)                             |  durability, retry, audit trail
|    queued -> sending -> sent | failed         |
+---------------+-------------------------------+
                v
+-----------------------------------------------+
| 3. Renderer (template registry)               |  subject / text / html
|    the escaping boundary for user content     |
+---------------+-------------------------------+
                v
+-----------------------------------------------+
| 2. Mailer  send(envelope)                     |  retry, suppression, send caps
+---------------+-------------------------------+
                v
+-----------------------------------------------+
| 1. Transport adapter (nodemailer SMTP)        |  the only provider-aware file
|    dev: console | test: json | prod: smtp     |
+-----------------------------------------------+
```

### 2.1 Layout

Follows the existing convention — cross-cutting infrastructure under `shared/`, stateful
features under `modules/`.

```
server/src/shared/mail/
  transport.js        # nodemailer factory: pooled, TLS-enforced, verified at boot
  mailer.js           # send(envelope) - retry, suppression check, caps
  render.js           # layout + interpolation
  escape.js           # HTML entity escape - the R4 analogue for email
  templates/
    _layout.js
    otpCode.js
    passwordChanged.js
    emailChangedNotice.js
  registry.js         # templateId -> { subject, category, render, priority }

server/src/modules/notifications/
  Outbox.model.js
  notify.js           # the single public entry point for all feature code
  worker.js           # drains the outbox; in-process now, separable later

server/src/modules/auth/
  OtpToken.model.js   # purpose-bound, hashed, attempt-capped
  otp.service.js      # issue / verify - no HTTP, no mail knowledge
```

### 2.2 The four frozen seams

These are the contract. Everything else may be rewritten freely; these must not move, because
moving them is what forces a rewrite of unrelated code.

1. **Call sites use `notify(event, payload)`** — never `sendMail`, never a template id. Adding
   in-app notifications or SMS later becomes a dispatcher change and touches zero controllers.
2. **The transport adapter interface is `send(envelope) -> { messageId }`.** Swapping SMTP for
   a provider's HTTP API is one file.
3. **Every send goes through an Outbox record**, even in Phase 1 where the worker runs
   in-process on a short interval. Moving to a real queue is then a worker change.
4. **Every template declares a `category`** from day one, even while nothing reads it.
   Retrofitting categories onto twenty existing templates is the migration to avoid.

---

## 3. Flows

### 3.1 Signup verification (`purpose: "email_verify"`)

```
POST /api/auth/register       -> 201 { token, user }   (user.emailVerifiedAt = null)
                                 issues an OTP, notify("auth.otp.requested")
POST /api/auth/otp/request    -> 202 always            (resend)
POST /api/auth/otp/verify     -> 200 { user }          sets emailVerifiedAt
```

The soft gate is enforced server-side (`R1`) by a `requireVerified` middleware on enrollment,
submission and doubt creation — **not** by hiding buttons in the client.

### 3.2 Password reset (`purpose: "password_reset"`)

```
POST /api/auth/otp/request    -> 202 always, identical for unknown addresses (M10)
POST /api/auth/otp/verify     -> 200 { actionToken }   5 min, single use (M12)
POST /api/auth/password/reset -> 200
     rotate password -> bump tokenVersion -> notify("auth.password.changed")
```

The action token exists so the client never re-transmits the OTP and the reset endpoint has
something it can actually verify. It is held in component state for the duration of the flow —
**never** `localStorage`, which would extend `G3` to a credential with reset power.

### 3.3 Email change (`purpose: "email_change"`)

```
PUT  /api/auth/me/email       -> 202   stores pendingEmail, OTPs the NEW address
POST /api/auth/otp/verify     -> 200   commits pendingEmail -> email
     and unconditionally notify("auth.email.changed") to the OLD address
```

The notice to the old address is the half people skip and the half that actually catches an
attack. It is not optional and is not preference-gated.

`PUT /api/auth/me` stops accepting `email` once this lands; name and phone continue to work as
they do now.

---

## 4. Data model

### 4.1 `OtpToken`

| Field | Notes |
|---|---|
| `email` | Lowercased. The target address — for `email_change` that is the **new** one |
| `userId` | Nullable: an OTP may exist before a user is known |
| `purpose` | `email_verify` \| `password_reset` \| `email_change` |
| `codeHash` | `HMAC-SHA256(code, OTP_PEPPER)` — never the code (`M2`) |
| `expiresAt` | +10 minutes. TTL index for cleanup, **checked in code** for enforcement (`M4`) |
| `attempts` | Wrong-guess counter, capped at 5 (`M6`) |
| `resendCount`, `lastSentAt` | Cooldown state, in the document rather than in memory (`M8`) |
| `consumedAt` | Single-use marker, set atomically (`M5`) |

Indexes: `{ email: 1, purpose: 1 }`, plus a TTL index on `expiresAt`.

### 4.2 `User` additions

```
emailVerifiedAt : Date | null
pendingEmail    : String             // set during an email change, cleared on commit
tokenVersion    : Number, default 0   // included in the JWT, compared in protect()
```

`tokenVersion` is nearly free to check: `A5` already reloads the user from the database on every
authenticated request. It is bumped on password change, password reset, and deactivation.

### 4.3 `Outbox`

`{ to, templateId, category, payload, idempotencyKey (unique), status, attempts, lastError,
scheduledFor, sentAt, messageId }`

`idempotencyKey` is uniquely indexed. Format: `{userId}:{template}:{entityId}:{bucket}`.
Without it, a retried cron job sends three hundred students a second "assignment due" email —
the class of bug that costs a sender its reputation.

---

## 5. OTP controls

These become `M1`–`M13` in `security.md` §4c once implemented and verified. The transport and
rendering controls they sit on top of are already recorded there as `E1`–`E10`.

| # | Control | Why |
|---|---|---|
| M1 | Code from `crypto.randomInt(0, 1_000_000)`, zero-padded to six digits | `Math.random` is predictable from prior output. CSPRNG, non-negotiable |
| M2 | Store `HMAC-SHA256(code, OTP_PEPPER)`, never the code | A database leak must not yield live codes. HMAC rather than bcrypt: the pepper lives in env, not the DB, so a Mongo-only leak is useless, and verification stays fast |
| M3 | `purpose` bound at issue, required at verify | A code mailed to verify a signup must not reset a password |
| M4 | Ten-minute TTL, enforced **in code**; the Mongo TTL index is cleanup only | The TTL monitor runs roughly once a minute and is not an expiry guarantee |
| M5 | Single use via atomic `findOneAndUpdate({ consumedAt: null }, ...)` | Two concurrent requests must not both consume one code |
| M6 | **Five wrong attempts destroys the code**, not merely throttles it | Six digits is one in a million; unlimited guesses inside ten minutes is genuinely brute-forceable. The hard cap is the real defence — rate limiting is secondary |
| M7 | Issuing a new code invalidates prior live codes for that `(email, purpose)` | Otherwise "resend" multiplies the attacker's guessing surface linearly |
| M8 | Attempt and resend counters live in the OTP document, not `express-rate-limit` memory | Addresses `G12` — in-memory counters reset on every deploy, a trivial bypass for a security-critical counter |
| M9 | `crypto.timingSafeEqual` for the hash comparison | Cheap; removes the timing oracle |
| M10 | Request-OTP returns the **same 202 for unknown addresses** | Mirrors `A10`. Otherwise this becomes the user-enumeration oracle that sign-in deliberately avoids |
| M11 | The code never enters a log line, an error message, or a response body | `shared/utils/logger.js` prints `err.message`; an OTP inside a thrown message would land in the platform log view |
| M12 | Verify returns a short-lived single-use **action token** (5 min, `purpose` claim, `jti`), not a boolean | The client never re-transmits the OTP, and the consuming endpoint has something verifiable |
| M13 | Resend cooldown 60s; at most 3 per 15 minutes per address; plus a per-IP cap | `R8` / `D6` — keyed on the actor, because shared campus NAT is the norm here |

---

## 6. Configuration

```bash
# Transport
MAIL_TRANSPORT=smtp          # smtp | console | json   (console/json are dev & test only)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587                # 587 + STARTTLS, or 465 implicit TLS. Never 25.
SMTP_SECURE=false            # true only for 465
SMTP_USER=
SMTP_PASS=                   # Gmail app password - never the account password

# Identity
MAIL_FROM=techdea.lms@gmail.com
MAIL_FROM_NAME=TechDea LMS
MAIL_REPLY_TO=

# Crypto
OTP_PEPPER=                  # 32+ random bytes, independent of JWT_SECRET
```

### 6.1 Transport settings that matter

```js
{
  pool: true, maxConnections: 2, maxMessages: 100,
  requireTLS: true,                    // STARTTLS mandatory on 587
  tls: { minVersion: "TLSv1.2" },      // and NEVER rejectUnauthorized: false
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
}
```

The timeouts are not optional on a single free-tier instance: a hung SMTP socket without them
holds a worker until the platform kills the process.

`rejectUnauthorized: false` deserves its own line. It is the most-copied snippet on the internet
for "fix SMTP certificate error", and it downgrades TLS to an unauthenticated channel that
anyone on-path can read — including every OTP. It must never appear in this codebase.

### 6.2 Fail-closed policy (`R10`, consistent with `A4`)

`MAIL_TRANSPORT` has four resolved states. **Implemented** in
`server/src/shared/mail/config.js`.

| `MAIL_TRANSPORT` | Behaviour |
|---|---|
| `smtp` | Real delivery. Any missing SMTP value **stops the boot** — there is no downgrade |
| `console` | Prints the rendered message. **Refused in production** |
| `json` | Returns the message as JSON, for tests. **Refused in production** |
| *unset* | `console` outside production; **`off` in production** — the service boots and serves normally, and every send is logged and skipped |

Two points are worth stating plainly, because the first draft of this document got the second
one wrong.

**There is no silent fallback from `smtp` to anything else.** A misconfigured SMTP host stops
the boot. That is the "development fallback that lets the app run insecurely" which `R10`
forbids, and it is the failure mode that matters: an app that boots and silently sends nothing
is an app where nobody can recover an account and nobody finds out until they try.

**`console` and `json` are refused in production rather than warned about.** They print or
return the full message body, which includes one-time codes — in production that writes codes
into the platform log view and breaks `M11`. The `off` state exists so that a deployment with
no mail configured is a *deliberate, visible* state rather than a reason to route codes through
the logs. It is the correct state during phases 0 and 1 of this plan, and it is recorded as a
gap in `security.md` for as long as it lasts.

### 6.3 Platform

`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `OTP_PEPPER` are added to `render.yaml` with
`sync: false` per `C2`. `MAIL_FROM`, `MAIL_FROM_NAME` and `MAIL_TRANSPORT` may be literals.

---

## 7. Deliverability

An OTP that lands in spam is a broken login, and it will be debugged as an application bug.

**Current setup — Gmail app password.** Requires 2FA on the Google account. Use a **dedicated
account**, not a personal one: the credential lives in the platform environment and should not
unlock a real inbox.

Known limits, accepted deliberately for Phase 1:

- **Roughly 500 recipients per day, shared across everything.** Fine for OTP. The moment
  assignment reminders exist, 300 students × 1 reminder consumes the entire daily quota in one
  batch — and OTP delivery stops with it.
- **No bounce or complaint reports.** A mistyped address fails silently and forever. There is
  no signal from which to build a suppression list.
- **No domain alignment.** SPF, DKIM and DMARC belong to a domain; none is owned yet.

**Measured, 2026-09-18.** Delivery itself works: Gmail accepted the credentials over STARTTLS
and all three OTP templates were delivered. **All three were filed as spam** at a recipient the
sender had never contacted before. That is the sender's reputation, not the message content — a
new account, no owned domain, no SPF/DKIM/DMARC. Recorded as `G21`.

This moves the migration trigger earlier than originally written. Spam placement is tolerable
for a reminder and **blocking** for a one-time code: a student who cannot see the code cannot
finish signing up. Development continues on Gmail because nothing above the transport layer
depends on the provider, but **an owned domain and a transactional provider are a launch
blocker, not a phase 3 nicety.**

**The trigger to migrate** is therefore the first real user, or Phase 3 (reminders and digests),
or the first day volume passes roughly 100 messages — whichever comes first. Migration means a transactional provider (SES,
Postmark, Resend, Brevo), a domain with SPF + DKIM + DMARC, and wiring the bounce webhook.
Under seam 2 (§2.2) that is one adapter file plus configuration.

When that happens, **separate the streams**: OTP and receipts must not share a sending identity
with digests and promotions. One complaint spike on marketing mail should not be able to take
down password reset.

---

## 8. Security considerations

### 8.1 Threats and controls

| Threat | Control |
|---|---|
| **Header / CRLF injection** into `to`, `from`, `replyTo`, `subject` | Only ever pass the **stored, schema-validated** address from the database into an envelope — never `req.body.email`. The mailer additionally rejects any recipient containing `\r` or `\n` |
| **Host-header poisoning of links** | Every URL is built from `CLIENT_ORIGIN`, never `req.headers.host`. This is the classic poisoned-reset-link vulnerability, and it is a one-line mistake |
| **HTML injection into message bodies** | Every interpolated value is escaped in the HTML part. A course title or a student name ends up in an email a *teacher* reads: this is `R4` extended to a new render sink |
| **Mail as a spam amplifier** | The OTP request endpoint is unauthenticated and causes outbound mail. Per-address cooldown (`M13`), per-IP cap, and a **global daily send ceiling** with a circuit breaker |
| **User enumeration** | `M10` — an identical response whether or not the account exists. Only the inbox differentiates |
| **Blocking the request thread** | Delivery is never awaited inside a request. Persist to the outbox, respond, drain asynchronously. SMTP latency is unbounded |
| **Secrets in logs** | `M11`, plus an explicit redaction list (`code`, `SMTP_PASS`, `OTP_PEPPER`, `actionToken`) applied in the mailer's error path |
| **Reset without revocation** | `tokenVersion`, bumped on every password change and reset |

### 8.2 New decisions (for `security.md` §7)

- **`D11` — Email is an identity channel.** Changing the address on an account requires proof of
  control of the new address, and always notifies the old one.
- **`D12` — Transactional and optional mail are separate categories.** Transactional mail ignores
  user preferences; optional mail must honour them and carry an unsubscribe path.
- **`D13` — SMTP is fail-closed in production.** The development transport is unreachable in
  production; misconfiguration stops the boot rather than silently disabling account recovery.

### 8.3 New rules (for `security.md` §10)

- **`R13`** — Nothing user-authored is interpolated into an email without escaping.
- **`R14`** — Every link in an email is built from `CLIENT_ORIGIN`, never the request host.
- **`R15`** — Every new outbound message declares a category and goes through `notify()`.

### 8.4 The takeover chain this closes

Worth recording explicitly, because it is the reason email change is in scope rather than
deferred:

1. An attacker obtains a token (`G3` — `localStorage`, amplified by any XSS).
2. `PUT /api/auth/me` currently writes a new email immediately, with no verification.
3. The victim notices something is wrong and changes their password. With `tokenVersion`, that
   now correctly kills the attacker's token.
4. But the attacker controls the address on the account, so they use password reset, receive the
   OTP in their own inbox, and lock the real owner out permanently.

Shipping reset without fixing step 2 would **raise** the value of a stolen token. §3.3 closes it.

---

## 9. Template catalogue and categories

Categories are the axis everything else hangs off, which is why every template declares one from
the first commit. Only the `security` and `account` rows exist in Phase 1; the rest document what
the design must survive.

| Category | Messages | Opt-out |
|---|---|---|
| `security` | OTP, email verified, password changed, email changed, new-device sign-in, repeated failed attempts (closes `G17`), account deactivated | Never |
| `account` | Welcome, staff invitation (a set-password link, better than an admin choosing a password — see `A9`), profile changes | Never |
| `billing` | Receipt, invoice, refund, failed payment, expiry | Never — legally required |
| `enrollment` | Enrollment confirmed, course completed, certificate issued | Partial |
| `coursework` | Assignment posted, due-date reminder (T-48h, T-2h), submission received, graded with feedback, quiz results | Yes |
| `doubts` | Your doubt was answered; a new doubt on your course | Yes |
| `announcements` | Instructor announcement, course updated, new lesson | Yes |
| `digest` | Weekly student progress, daily teacher summary, admin ops report | Yes |
| `marketing` | Recommendations, promotions, re-engagement | **Mandatory**, one-click |

### 9.1 What the catalogue demands of the design

1. **Per-user, per-category preferences** — a `notificationPrefs` subdocument on `User`, enforced
   centrally in the dispatcher so that no call site can forget it.
2. **One-click unsubscribe** — `List-Unsubscribe` and `List-Unsubscribe-Post` headers plus an
   HMAC-signed, no-login token URL. Major mailbox providers now require this of bulk senders. The
   token scheme should be settled before the first optional email, not after.
3. **Idempotency keys** (§4.3) — or cron retries duplicate every scheduled message.
4. **Scheduled sends** — a `scheduledFor` field and a sweeper, not `setTimeout`. Note the platform
   constraint: a free instance sleeps, so an in-process timer is not a reliable scheduler.
   Reminders need a paid instance, a platform cron job, or an external ping.
5. **Chunked fan-out** — one announcement to 500 students is 500 outbox rows written in batches,
   never one message with 500 BCCs (which leaks the roster and reads as spam).
6. **Digests need stored events, not just sent mail.** If "doubt answered" exists only as an
   email, it can never be rolled into a weekly digest without being rebuilt.
7. **A suppression list**, checked before every send, transactional included.
8. **Timezone and locale on the user** — a 9am reminder in the wrong timezone is worse than none.

### 9.2 Billing, when it arrives

There is no payments module today. Receipts carry PII and amounts, and a PDF invoice introduces
file generation, which brushes against `D10` ("no file uploads"). That conflict must be raised
and decided under `R12` rather than arriving by accident.

### 9.3 Not doing

Open- and click-tracking pixels. In `security` category mail especially they are a privacy
problem, and they add nothing operationally.

---

## 10. Frozen now vs. deferred

**Must exist in Phase 1, because retrofitting is expensive:** the `notify()` seam; the Outbox
record; `category` on every template; the transport adapter interface; `purpose` on the OTP; the
escaping boundary; idempotency keys.

**Safely deferred:** a real queue (Redis/BullMQ); provider webhooks and the suppression list; the
preference UI; digest aggregation; localization; analytics.

---

## 11. Phasing

| Phase | Scope |
|---|---|
| **0** | `shared/mail/` skeleton, transport and config validation, console transport, one smoke template. No user-facing change |
| **1** | OTP model and service; signup verification (soft gate); password reset; `tokenVersion` revocation; verified email change. Closes `G5` and `G7`; narrows `G2` |
| **2** | Outbox and worker; security notifications (closes `G17`); enrollment and coursework transactional mail |
| **3** | Preferences, unsubscribe, scheduled reminders, digests. Forces the provider migration (§7) |
| **4** | Provider webhooks, suppression list, deliverability monitoring |

---

## 12. Expected `security.md` deltas

To be written **on implementation, after verification** — per the §11 checklist in that document,
nothing is recorded as Implemented on the strength of a plan.

- **§4b "Outbound email"** — transport and rendering controls `E1`–`E10`. **Done**, landed
  with phase 0.
- **New §4c "One-time codes"** — the OTP controls `M1`–`M13` (phase 1).
- **§7** — decisions `D11`, `D12`, `D13`.
- **§10** — rules `R13`, `R14`, `R15`.
- **§8** — `G5` and `G7` closed; `G2` narrowed to logout only; `G12` narrowed (OTP counters are
  now persistent, the `express-rate-limit` gap remains); `G17` closed in Phase 2.
- **§8, new gaps** — no bounce handling in Phase 1; an in-process worker means a crash mid-send
  can drop a message; no DMARC until a domain exists; the ~500/day Gmail ceiling becomes a hard
  dependency of account recovery.
- **§13** — change log entry.
