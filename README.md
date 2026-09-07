# TechDea LMS (MERN)

Student learning platform — **React + Express + MongoDB + Node**. Three roles:
**student**, **teacher**, **admin**. Visual design matched to
[learn.techdea.in](https://learn.techdea.in/) (the design system lives in
`client/src/styles/` — `techdea.css` tokens/components + `app.css` portal shell).

Lesson videos are **not** stored or streamed by this app — a lesson holds an
optional `videoUrl` string and the player shows a placeholder box.

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

Students register themselves at `/signup`.

## Roles

| | Student | Teacher | Admin |
|---|---|---|---|
| Browse / enroll / learn / track progress | ✅ | ✅ | ✅ |
| Create courses & lessons | — | own | any |
| Publish / unpublish | — | own | any |
| See enrolled students | — | own courses | all courses |
| Manage users & roles | — | — | ✅ |

Course ownership is enforced server-side: a teacher route checks
`course.owner === req.user._id`; admins bypass that check.

## API overview

```
POST   /api/auth/register            student sign-up
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/me                   name / email / phone
PUT    /api/auth/me/password

GET    /api/courses                   published catalog
GET    /api/courses/manage            teacher: own · admin: all
GET    /api/courses/:id               detail + lessons
POST   /api/courses                   (teacher/admin)
PUT    /api/courses/:id               (owner/admin)
DELETE /api/courses/:id               (owner/admin)
PATCH  /api/courses/:id/publish       (owner/admin)
PATCH  /api/courses/:id/owner         (admin) reassign
GET    /api/courses/:id/enrollments   (owner/admin)

GET    /api/courses/:id/lessons
POST   /api/courses/:id/lessons              (owner/admin)
PUT    /api/courses/:id/lessons/reorder      (owner/admin)
PUT    /api/courses/:id/lessons/:lessonId    (owner/admin)
DELETE /api/courses/:id/lessons/:lessonId    (owner/admin)

POST   /api/enrollments                 { courseId }
GET    /api/enrollments/mine
DELETE /api/enrollments/:courseId
POST   /api/enrollments/:courseId/complete   { lessonId }
GET    /api/enrollments/all             (admin)

GET    /api/users                       (admin)
POST   /api/users                       (admin) create teacher/admin
PATCH  /api/users/:id/role              (admin)
PATCH  /api/users/:id/active            (admin)
DELETE /api/users/:id                   (admin)
```
