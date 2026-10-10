<div align="center">

<img src="client/public/techdea-logo.png" alt="TechDea" width="104" height="104">

# TechDea LMS

**Converts Ideas Into Technologies**

A learning platform for structured courses — video, reading and downloadable
lessons, with progress tracking, assignments, quizzes and a doubts inbox.
Built as a MERN app and styled to match [learn.techdea.in](https://learn.techdea.in/).

<br>

![React](https://img.shields.io/badge/React-18-6D28D9?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-6D28D9?style=flat-square&logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-18%2B-6D28D9?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-6D28D9?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-6D28D9?style=flat-square&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-4C1D95?style=flat-square&logo=jsonwebtokens&logoColor=white)

**[Quick start](#quick-start)** · **[Structure](#project-structure)** · **[API](#api-reference)** · **[Security](#security)** · **[Deploy](#deployment)**

</div>

---

## What this is

Three roles — **student**, **teacher**, **admin** — on one codebase.

| | What they do |
|---|---|
| 🎓 **Student** | Browse the catalog, enrol, work through lessons, keep private notes, resume where they left off, submit assignments, take timed quizzes, ask doubts, rate courses. |
| 🧑‍🏫 **Teacher** | Author courses and lessons (drag to reorder), publish, build assignments and quizzes, grade submissions, answer doubts, watch a roster and a performance view — **for their own courses only**. |
| 🛡️ **Admin** | Everything a teacher can do, on every course, plus user management: create any account, change roles, deactivate, set passwords, and bulk-import a cohort from a CSV. |

Lessons come in three types — **video**, **reading**, **file**. Reading lessons
(and a video's description) support **simple formatting** — headings, bold,
lists, links — with a **Preview** tab in the editor that shows the student's page
exactly. Media is **not** hosted here: a video lesson holds an embed/watch URL (YouTube/Vimeo/…), a file
lesson holds a link plus a display name, and the player renders accordingly.

```
server/   Express API + Mongoose models   (port 5000)
client/   React app (Vite)                (port 5173, proxies /api → 5000)
```

---

## Quick start

**You need:** Node 18+, and a MongoDB you can reach — either a local
**MongoDB Community Server** on `mongodb://127.0.0.1:27017`, or a free
**MongoDB Atlas** cluster (put its URI in `server/.env`).

```bash
# 1. API
cd server
npm install
cp .env.example .env        # then edit MONGO_URI / JWT_SECRET
npm run dev                 # http://localhost:5000

# 2. Web app (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open **http://localhost:5173**.

The repo root has shortcuts so you can stay in one directory — they only
delegate to the two packages, there is nothing to install at the root:

```bash
npm run install:all   # npm install in both client and server
npm run dev:api       # = npm --prefix server run dev
npm run dev:web       # = npm --prefix client run dev
npm run build         # = npm --prefix client run build
```

### Environment

`server/.env` (copy from `.env.example`):

| Variable | Meaning |
|---|---|
| `PORT` | API port, default `5000` |
| `MONGO_URI` | Mongo connection string |
| `JWT_SECRET` | long random string — changing it invalidates every session |
| `JWT_EXPIRES` | token lifetime, default `7d` |
| `CLIENT_ORIGIN` | exact origin allowed by CORS, no trailing slash |

The client reads `VITE_API_URL` in production (it **must** include the `/api`
path). In dev it proxies `/api` to port 5000, so nothing is needed locally.

### Your first admin

There is **no seed script** — an empty database has no accounts, by design, so a
deployment never ships with a known password.

1. Register at `/signup`. That account is a **student**.
2. Promote it in MongoDB:

```bash
mongosh "mongodb://127.0.0.1:27017/techdea_lms" --eval 'db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })'
```

3. Sign out and back in. Everything else — teachers, more admins, whole cohorts —
   is done from **Admin › Users** inside the app.

---

## Feature tour

### Learning
Catalog and course detail · enrolment · the lesson player for all three lesson
types · per-lesson completion and a progress ring · **private per-lesson notes** ·
**resume where you left off** · one rating + review per student per course.

### Assignments & quizzes
Teachers build **assignments** (instructions, due date **and time**, marks) and **quizzes**
(multiple-choice questions, pass mark, optional time limit) per course from
`/teach/assignments` — a modal builder plus a submissions inbox — publish them
like lessons, and grade what comes in.

Due dates are **Indian Standard Time** for everyone — the teacher picks a date and
a time, and that one moment is what every student's screen shows, whatever timezone
their device is set to. The deadline is **enforced on the server**: once it passes,
the form is replaced by *"This closed on …"* and a late `submit` is refused. Only
the teacher can reopen one — by moving the due date, or by sending a submission
back — and a timed quiz's countdown is capped so an attempt can't run past close.

Students see everything in one list at `/assignments`, then open a full page
(`/assignments/:id`) to work. Assignments take text plus an optional link (the
app has no file storage). Quizzes show one question card per item with a
**sticky countdown that auto-submits at zero**, then **auto-grade on submit** and
reveal the answer key for review. Teachers can still override the score and add
feedback. One attempt per student — a student can neither edit nor withdraw what
they handed in.

An **assignment** can be reopened, but only by the teacher: **Send back** in the
submissions inbox returns it with a required note, clears any score on it, and
puts it back in the student's To-do list with the form pre-filled. A quiz cannot
be sent back — its answer key is revealed once attempted, so a second try would
be taken with the answers in hand.

### Doubts
Students ask a question against a course, optionally pinned to a lesson.
Teachers answer the ones on their own courses; admins see all of them.

### User management & bulk import
**Admin › Users** lists everyone with a course count, and can create an account
of any role — student, teacher or admin — change roles, deactivate accounts and
set a password. The password typed on that form is temporary: the account is
held to one screen until its owner chooses their own. Creating an **admin** is
deliberately one-at-a-time; a spreadsheet cannot mint one.

**Bulk import** takes a CSV with `name`, `email` and an optional `role`
(`student` or `teacher` — admins stay a deliberate, one-at-a-time act). The
browser parses the file and posts plain JSON; nothing is uploaded and nothing is
written to disk. The server builds each password from the person's own name plus
two random digits, so it is sayable down a phone, and returns it **once** —
download the CSV of credentials on that screen or it is gone. The browser sends
the rows in chunks of 10, under a server cap of 20 per request, so a large cohort
goes up in visible pieces rather than one long wait.

### Passwords and signing out
A password must be at least 8 characters with a letter and a number, and can't
be a very common one or just your name plus digits. The same rule applies to
signup, changing a password, and an admin typing one. Signing out ends that
session on the server too, so a copied token stops working; other devices stay
signed in.

### Passwords somebody else chose
Any account whose password was set by an admin or generated by an import is
flagged `mustChangePassword`. Until it is cleared the account can do exactly two
things — read itself and change its password — enforced in the `protect`
middleware, so a new endpoint is covered the day it is written. The client routes
those users to a single screen with no URL around it.

### Account recovery
**There is no reset-by-email**, because there is no mailer — the email subsystem
was removed when free hosting left nothing to send from. `/forgot-password` says
so and points the user at an admin, who sets a new password from
**Admin › Users**. That signs the account out everywhere and forces a change on
first sign-in.

### Not built yet
- No file uploads anywhere — lessons and submissions carry links. (Course
  thumbnails are the one exception in spirit: the browser resizes the image and
  stores it on the course as a `data:` URL, so nothing is uploaded or written to
  disk.)

---

## Project structure

Both halves are grouped **by feature**, not by technical layer, and both use the
same vocabulary: a `<feature>` folder owns its screens and logic, and `shared/`
holds what more than one feature needs. To change a screen, open the folder named
after it — everything that screen owns is inside.

> **Finding things fast:** don't browse the tree. In VS Code, `Ctrl+P` then a few
> letters of the filename jumps straight there (`dash` → `Dashboard.jsx`), and
> `Ctrl+Shift+F` searches contents. Server files are named `<feature>.routes.js` /
> `<feature>.controller.js` / `<Entity>.model.js`, so typing `course.` lists that
> whole feature at once.

### `server/` — Express API

Each folder under `modules/` is one slice of the domain and holds its **routes,
controller and Mongoose model together**.

```
server/
└── src/
    ├── index.js                    process bootstrap (env, DB, listen)
    ├── app.js                      express wiring + route mounts  ← start here
    ├── config/db.js                Mongoose connection
    ├── shared/                     cross-cutting; modules import from here
    │   ├── middleware/             auth (protect/requireRole), error,
    │   │                           rateLimit, requestId
    │   ├── db/safeWrites.js        guarded update helpers
    │   └── utils/                  asyncHandler, constants, logger, token, url
    └── modules/
        ├── auth/                   auth.routes.js · auth.controller.js
        ├── users/                  + User.model.js          → /api/users
        ├── courses/                + Course.model.js        → /api/courses
        ├── lessons/                + Lesson.model.js        → nested under courses
        ├── reviews/                review.controller.js + Review.model.js
        │                           (no routes file — mounted by courses)
        ├── enrollments/            + Enrollment.model.js    → /api/enrollments
        ├── assessments/            + Assessment.model.js    → /api/assessments
        ├── submissions/            + Submission.model.js    → /api/submissions
        ├── doubts/                 + Doubt.model.js         → /api/doubts
        └── students/               roster endpoint          → /api/students
```

Dependencies point one way — `modules/` may import from `shared/` and `config/`,
never the reverse.

### `client/` — React SPA

Pages are grouped by **who uses them**, which is the same split the router and
`ProtectedRoute` already enforce.

```
client/src/
├── app/                    App.jsx (the route table), main.jsx, NotFound.jsx
├── features/
│   ├── auth/pages/         Login, Signup, ForgotPassword, ForcePasswordChange
│   │   └── components/     AuthLayout, ProtectedRoute  (+ AuthContext.jsx)
│   ├── student/            Dashboard, Catalog, CourseDetails, MyLearning,
│   │                       LessonPlayer, ProgressPage, StudentAssignments,
│   │                       AssessmentDetail, StudentDoubts
│   ├── teacher/pages/      TeacherDashboard, ManageCourses, CourseEditor,
│   │   │                   CourseEnrollments, TeacherStudents,
│   │   │                   TeacherAssignments, TeacherDoubts, TeacherPerformance
│   │   └── components/     CoursePreview
│   ├── admin/              AdminUsers, BulkImport
│   └── account/            Profile  (shared by every signed-in role)
├── shared/
│   ├── api/client.js       axios instance, token header, 401 handling
│   ├── components/
│   │   ├── ui/             Bar, Ring, Stat, Loaders, CourseThumb,
│   │   │                   VideoPlaceholder (via index.js barrel);
│   │   │                   Modal, Select, Stars, PasswordInput
│   │   ├── layout/         Layout (sidebar + top bar), AccountMenu, Brand
│   │   ├── lesson/         LessonContent, FileViewer
│   │   └── ErrorBoundary.jsx
│   ├── context/            ToastContext, ConfirmContext
│   ├── hooks/              useLoad, useMediaQuery
│   └── lib/                assessments, fileKind, format, image,
│                           lessonTypes, roles, safeUrl
└── styles/                 index.css imports the rest — see below
```

A feature only gets `pages/` + `components/` subfolders once it has both —
`auth/` and `teacher/` do; the rest keep their screens at the top level rather
than adding a folder that holds one thing.

**Imports use the `@` alias** for `client/src`, so a path never changes when a
file moves depth:

```js
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader } from "@/shared/components/ui";
```

Configured in `vite.config.js` (`resolve.alias`) and `jsconfig.json` (for editor
go-to-definition). Only same-folder imports stay relative.

---

## Design system

Visual language matched to [learn.techdea.in](https://learn.techdea.in/): Inter
throughout, **violet `#6d28d9`** on an off-white `#faf9fd` ground, rounded corners
(10–20px), pill tags, and a near-black `#171126` portal sidebar. The lockup —
badge, wordmark and tagline — lives in one component
(`shared/components/layout/Brand.jsx`) so the brand is identical in the sidebar,
the auth screens and the boot splash.

Global CSS, loaded by one entry point. `main.jsx` imports **only**
`@/styles/index.css`, which `@import`s the rest:

```
client/src/styles/
├── index.css               the entry — ORDER MATTERS, see the note inside
├── design-system.css       tokens + base classes (.btn, .card, .tag, .table…)
├── app-shell.css           sidebar, top bar, page frame, loaders
├── auth.css                login / signup / forgot-password
├── screens.css             every screen inside the shell, in labelled sections
└── responsive.css          phone breakpoints, last so they win
```

These are plain global sheets where later rules are meant to beat earlier ones,
so `index.css` keeps them in a fixed order. `screens.css` is signposted with
`══════════ SECTION ══════════` banners — search for `TABLES`, `DASHBOARD`,
`ASSESSMENTS`, `PROFILE` to jump. **Add new rules at the end of `screens.css`**
rather than importing CSS from a component, which would land it in the cascade at
an unpredictable point.

---

## Permissions

**Learning is the student's half of the app, and only theirs.** A teacher or admin
cannot enrol, so the five rows below that only students have are refused twice over:
the router sends staff to `/teach`, and the API answers *"Only students can enrol in
courses"* / *"Enrol in the course to ask a doubt"*. Staff who want to see a course the
way a student does use **Preview as student** in the course editor.

| | Student | Teacher | Admin |
|---|---|---|---|
| Browse / enrol / learn / track progress | ✅ | — | — |
| Per-lesson private notes · resume where you left off | ✅ | — | — |
| Rate & review a course (1 per student) | ✅ | — | — |
| Ask doubts on a course / lesson | ✅ | — | — |
| Submit assignments · take quizzes | ✅ | — | — |
| Preview a course as a student would see it | — | own | any |
| Answer doubts | — | own courses | any |
| Create courses & lessons | — | own | any |
| Create assignments & quizzes · grade submissions | — | own courses | any |
| Publish / unpublish | — | own | any |
| See enrolled students / roster / performance | — | own courses | all courses |
| Manage users & roles · set passwords · bulk import | — | — | ✅ |

Course ownership is enforced server-side: a teacher route checks
`course.owner === req.user._id`; admins bypass that check. The client's own checks
are UX, never enforcement.

---

## API reference

```
GET    /api/health                    { ok, time }

POST   /api/auth/register             student sign-up
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/me                   name / email / phone
PUT    /api/auth/me/password

GET    /api/courses                   published catalog
GET    /api/courses/manage            teacher: own · admin: all
POST   /api/courses                          (teacher/admin)
GET    /api/courses/:id                      detail + lessons (optional auth)
PUT    /api/courses/:id                      (owner/admin)
DELETE /api/courses/:id                      (owner/admin)
PATCH  /api/courses/:id/publish              (owner/admin)
PATCH  /api/courses/:id/owner                (admin) reassign
GET    /api/courses/:id/enrollments          (owner/admin)
GET    /api/courses/:id/performance          (owner/admin) progress + per-assessment
                                             submissions, graded, avg, pass rate

GET    /api/courses/:id/reviews              list (optional auth)
POST   /api/courses/:id/reviews              { rating, text } — create/update mine
DELETE /api/courses/:id/reviews/mine

GET    /api/courses/:id/lessons
POST   /api/courses/:id/lessons              (owner/admin)
PUT    /api/courses/:id/lessons/reorder      (owner/admin)  { orderedIds: [every lesson, once] }
PUT    /api/courses/:id/lessons/:lessonId    (owner/admin)
DELETE /api/courses/:id/lessons/:lessonId    (owner/admin)

POST   /api/enrollments                      (student) { courseId }
GET    /api/enrollments/mine
GET    /api/enrollments/all                  (admin)
DELETE /api/enrollments/:courseId
GET    /api/enrollments/:courseId/notes
PUT    /api/enrollments/:courseId/notes/:lessonId   { text }
POST   /api/enrollments/:courseId/visit             { lessonId } — resume pointer
POST   /api/enrollments/:courseId/complete          { lessonId }

GET    /api/doubts/mine                      student's own doubts
POST   /api/doubts                           { courseId, lessonId?, text }
GET    /api/doubts/teaching                  (teacher/admin) doubts on my courses
PATCH  /api/doubts/:id                       (teacher/admin) post an answer

GET    /api/assessments/mine                 student — across enrolled courses
GET    /api/assessments?courseId=            (owner/admin) list + submission counts
POST   /api/assessments                      (owner/admin) { courseId, kind, title, … }
GET    /api/assessments/:id                  detail (students: published only,
                                             answer key hidden until attempted)
PUT    /api/assessments/:id                  (owner/admin)
DELETE /api/assessments/:id                  (owner/admin) — cascades submissions
PATCH  /api/assessments/:id/publish          (owner/admin)
POST   /api/assessments/:id/submit           student — assignment { text, link }
                                             · quiz { answers } (auto-graded)
GET    /api/assessments/:id/submissions      (owner/admin) inbox + who hasn't submitted
GET    /api/submissions/pending              (teacher/admin) ungraded, by course
PATCH  /api/submissions/:id/grade            (owner/admin) { score, feedback }
PATCH  /api/submissions/:id/return           (owner/admin) { feedback } — send an
                                             assignment back for another try

GET    /api/students                         (teacher/admin) roster across my courses

GET    /api/users?role=&q=                   (admin)
POST   /api/users                            (admin) create any role
POST   /api/users/bulk                       (admin) { people: [{ name, email, role }] }
PATCH  /api/users/:id/role                   (admin)
PATCH  /api/users/:id/password               (admin) set a password
PATCH  /api/users/:id/active                 (admin)
DELETE /api/users/:id                        (admin)
```

---

## Data models

- **User** — name, email, passwordHash, phone, `role` (student/teacher/admin),
  `active`, `tokenVersion` (bumped to kill every existing session),
  `mustChangePassword` (set when somebody else chose the password)
- **Course** — title, description, category, difficulty, prerequisites, `learn[]`,
  hours, thumbnailUrl, `owner`, `teacherName` (display credit), `published`
- **Lesson** — course, `module` label, title, `order`, `type` (video/reading/file),
  durationMin, `published`, plus `videoUrl` / `content` / `fileUrl` + `fileName`
- **Enrollment** — student, course, `completedLessons[]`, `notes` (Map lessonId→text),
  `lastLessonId` (resume), `status` (active/completed), `completedAt`
- **Review** — course, student, `rating` 1–5, text — unique per (course, student)
- **Doubt** — course, optional lesson, student, text, `status` (open/answered/resolved),
  `answer`, `answeredBy`, `answeredAt`
- **Assessment** — course, `kind` (assignment/quiz), title, instructions, `dueAt`,
  `published`; assignment: `points`; quiz: `questions[] {text, options[], correctIndex}`,
  `passPercent`, `timeLimitMin`
- **Submission** — assessment, course, student, `kind`; assignment: `text` + `link`;
  quiz: `answers[]` + `autoScore`; grading: `score`, `feedback`, `status`
  (submitted/graded), `gradedBy`, `gradedAt` — unique per (assessment, student)

---

## Security

The shape, in short:

```
Browser (React SPA)
   │  Bearer JWT in the Authorization header — token in localStorage
   ▼
Express API   helmet → cors → json(3mb) → [rate limit] → protect → requireRole → controller
   ▼
MongoDB via Mongoose (schema-typed, strictQuery)
```

- **Sessions** — the JWT carries a `tokenVersion`; bumping it on a password change
  or a deactivation refuses every token minted before it, so "I changed my
  password because I was hacked" is actually true. Signing out revokes that one
  token on the server as well.
- **Passwords** — bcrypt cost 12; at least 8 characters with a letter and a number.
- **Headers** — `helmet` on the API; the client gets a CSP (`script-src 'self'`)
  and standard headers from `render.yaml`. CORS allows only `CLIENT_ORIGIN`, and
  nothing at all when it is unset.
- **Authorization** — two layers: `requireRole` for the role, then an ownership
  check inside the controller. Enrolment is an access gate; drafts and quiz answer
  keys stay hidden until the student has attempted.
- **URLs** — lesson and submission links pass a scheme allowlist before they ever
  reach an `<iframe>` or an `<a>`. That is the XSS boundary.
- **Rate limits** — sign-in 8 failures per 15 min keyed on **IP + email** (a whole
  college behind one NAT address must not lock out over one typo) · signup 10/hr ·
  password change 10 per 15 min · admin password set 20 · bulk import 30.
- **Nothing is uploaded to the server** — the bulk import parses CSV in the browser
  and posts JSON, so there is no multipart body and no parser of someone else's
  format running on the server. A course thumbnail is picked from disk but never
  leaves the browser either: it is resized there and stored on the course as a
  `data:` URL inside the ordinary JSON body.

---

## Deployment

[`render.yaml`](render.yaml) is a Render blueprint for two services — the Express
API (`web`, `rootDir: server`, health check `/api/health`) and the Vite client
(`static`, `rootDir: client`, publishing `dist`, with an SPA rewrite to
`index.html`). Import it via **Render › Blueprints**, or use it as the reference
for manual setup. Secrets (`MONGO_URI`, `JWT_SECRET`) are `sync: false` — set them
in the dashboard. `CLIENT_ORIGIN` on the API and `VITE_API_URL` on the client must
point at each other, and `VITE_API_URL` includes the `/api` path.


<div align="center">
<br>
<img src="client/public/techdea-logo.png" alt="" width="40" height="40">
<br>
<sub><strong>TechDea</strong> — Converts Ideas Into Technologies</sub>
</div>
