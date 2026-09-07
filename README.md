# TechDea LMS (MERN)

Student learning platform — **React + Express + MongoDB + Node**. Three roles:
**student**, **teacher**, **admin**. Visual design matched to
[learn.techdea.in](https://learn.techdea.in/) (the design system lives in
`client/src/styles/` — `techdea.css` tokens/components + `app.css` portal shell).

Lessons come in three types — **video**, **reading**, **file**. Media is **not**
hosted here: a video lesson holds an embed/watch URL (YouTube/Vimeo/…), a file
lesson holds a link + display name, and the player renders accordingly.

```
server/   Express API + Mongoose models        (port 5000)
client/   React app (Vite)                      (port 5173, proxies /api → 5000)
styles/   original design-system source (also copied into client/src/styles)
```

## Prerequisites

- Node 18+
- A MongoDB you can connect to — either
  - local **MongoDB Community Server** running on `mongodb://127.0.0.1:27017`, or
  - a free **MongoDB Atlas** cluster (put its URI in `server/.env`)

## Setup

```bash
# 1. API
cd server
npm install
cp .env.example .env        # then edit MONGO_URI / JWT_SECRET if needed
npm run seed                # creates the admin + a sample teacher + 2 courses
npm run dev                 # http://localhost:5000

# 2. Web app (second terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173.

## Seeded logins

| Role    | Email                     | Password       |
|---------|---------------------------|----------------|
| admin   | admin@techdea.local       | admin12345     |
| teacher | teacher@techdea.local     | teacher12345   |

Students register themselves at `/signup`. Auth is JWT (bcryptjs hashes, token in
`localStorage`); the login / signup screens use a split-screen layout with
inline per-field validation and a show/hide password toggle.

## Roles

| | Student | Teacher | Admin |
|---|---|---|---|
| Browse / enroll / learn / track progress | ✅ | ✅ | ✅ |
| Per-lesson private notes · resume where you left off | ✅ | ✅ | ✅ |
| Rate & review a course (1 per student) | ✅ | ✅ | ✅ |
| Ask doubts on a course / lesson | ✅ | ✅ | ✅ |
| Submit assignments · take quizzes | ✅ | ✅ | ✅ |
| Answer doubts | — | own courses | any |
| Create courses & lessons | — | own | any |
| Create assignments & quizzes · grade submissions | — | own courses | any |
| Publish / unpublish | — | own | any |
| See enrolled students / roster / performance | — | own courses | all courses |
| Manage users & roles | — | — | ✅ |

Course ownership is enforced server-side: a teacher route checks
`course.owner === req.user._id`; admins bypass that check.

## Feature status

Implemented end-to-end: auth & profile, course catalog + detail, course/lesson
authoring with drag reorder, enrollment, lesson completion & progress, per-lesson
notes, "resume where you left off", course reviews/ratings, the doubts Q&A
inbox, the teacher student roster & performance view, admin user management, and
**assignments & quizzes** (see below).

**Assignments & Quizzes** — teachers build assignments (instructions, due date,
marks) and quizzes (multiple-choice questions, pass mark, optional time limit)
per course from `/teach/assignments` (modal builder + submissions inbox),
publish them like lessons, and grade what comes in. Students see everything in
one list at `/assignments`, then open a full page (`/assignments/:id`) to work:
assignments are text + an optional link (the app has no file storage); quizzes
show one question card per item with a **sticky countdown** that auto-submits at
zero, then **auto-grade on submit** and reveal the answer key for review.
Teachers can still override the score and add feedback. One attempt per student.
The teacher Performance page does **not** yet fold in assessment scores.

**Forgot password** — the login screen links to `/forgot-password`, but
reset-by-email isn't wired up. That page tells the user to ask an admin (Admin ›
Users) or change it from Profile. Add a mailer + reset-token flow to finish it.

## API overview

```
POST   /api/auth/register            student sign-up
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
GET    /api/courses/:id/performance          (owner/admin) per-course analytics

GET    /api/courses/:id/reviews              list (optional auth)
POST   /api/courses/:id/reviews              { rating, text } — create/update mine
DELETE /api/courses/:id/reviews/mine

GET    /api/courses/:id/lessons
POST   /api/courses/:id/lessons              (owner/admin)
PUT    /api/courses/:id/lessons/reorder      (owner/admin)
PUT    /api/courses/:id/lessons/:lessonId    (owner/admin)
DELETE /api/courses/:id/lessons/:lessonId    (owner/admin)

POST   /api/enrollments                      { courseId }
GET    /api/enrollments/mine
GET    /api/enrollments/all                  (admin)
DELETE /api/enrollments/:courseId
GET    /api/enrollments/:courseId/notes
PUT    /api/enrollments/:courseId/notes/:lessonId   { text }
POST   /api/enrollments/:courseId/visit             { lessonId } — resume pointer
POST   /api/enrollments/:courseId/complete          { lessonId }

GET    /api/doubts/mine                       student's own doubts
POST   /api/doubts                            { courseId, lessonId?, text }
GET    /api/doubts/teaching                   (teacher/admin) doubts on my courses
PATCH  /api/doubts/:id                        (teacher/admin) post an answer

GET    /api/assessments/mine                 student — assignments/quizzes across enrolled courses
GET    /api/assessments?courseId=            (owner/admin) list for one course + submission counts
POST   /api/assessments                      (owner/admin) { courseId, kind, title, ... }
GET    /api/assessments/:id                  detail (students: published + answer key hidden until attempted)
PUT    /api/assessments/:id                  (owner/admin)
DELETE /api/assessments/:id                  (owner/admin) — cascades submissions
PATCH  /api/assessments/:id/publish          (owner/admin)
POST   /api/assessments/:id/submit           student — assignment { text, link } · quiz { answers } (auto-graded)
GET    /api/assessments/:id/submissions      (owner/admin) inbox + who hasn't submitted
PATCH  /api/submissions/:id/grade            (owner/admin) { score, feedback }

GET    /api/students                          (teacher/admin) roster across my courses

GET    /api/users                            (admin)
POST   /api/users                            (admin) create teacher/admin
PATCH  /api/users/:id/role                   (admin)
PATCH  /api/users/:id/active                 (admin)
DELETE /api/users/:id                        (admin)
```

## Data models

- **User** — name, email, passwordHash, phone, `role` (student/teacher/admin), `active`
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
