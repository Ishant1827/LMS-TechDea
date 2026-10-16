# Fix list

From the code review on 2026-10-15. Numbers (#) match the original review. Tick = fixed.

**Progress: 21 / 21 done ✅** · all fixed on 2026-10-16 · not yet saved to git

**How to re-check everything:** in the `server` folder, run `npm test`. It needs MongoDB running on this computer and only uses a throwaway `techdea_test` database. It runs 22 checks, one group per fix.

Legend: 🔴 wrong results · 🟠 security / data · 🟡 cleanup

---

## Step 1: wrong results (🔴)

- [x] **#1 🔴 Quiz timeout submitted blank answers** ✅
  - Now: when time runs out, the student's picked answers are sent.
  - Tested in the browser: time ran out and the quiz scored 50% (before the fix it would have been 0%).

- [x] **#4 🔴 "Save grade" with no marks counted as graded** ✅
  - Now: work is "graded" only when marks are given, and the grade box asks for marks first.

- [x] **#13 🟡 Deleting a lesson left it in students' progress** ✅
  - Now: deleting a lesson also removes it from progress, notes and the "continue" spot.

- [x] **#5 🔴 Course marked complete when it wasn't; draft lessons could be completed** ✅
  - Now: "complete" means every visible lesson is done, and draft lessons can't be completed.

- [x] **#6 🔴 Teacher progress could show more than 100%** ✅
  - Now: teacher pages count only lessons students can still see.

- [x] **#14 🟡 "Completed" stayed even after new lessons were added** ✅
  - Now: worked out from current progress, so a new lesson puts the course back to "in progress".

- [x] **#2 🔴 Quiz time limit could be beaten by refreshing** ✅
  - Now: timed quizzes have a **Start quiz** button and the questions stay hidden until it's pressed. The server remembers the start time, the timer carries on after a refresh, and answers more than 1 minute late are refused.
  - Tested in the browser: after a refresh at 00:42 the timer and the answers were kept.

- [x] **#3 🔴 Quiz answers were shown as soon as one student submitted** ✅
  - Now: students see their score right away, but the correct answers only after the due date. With no due date, the correct answers are never shown. The page tells the student which applies.

## Step 2: security and data (🟠)

- [x] **#7 🟠 Imported accounts had guessable name-based passwords** ✅
  - Now: imported passwords are random, easy-to-say words like `river-tiger-427` (about 9 million options instead of about 400). There's also a new limit of 30 wrong sign-ins per hour per account, from any internet address.
  - Note: the old name-based style had been asked for by the owner. It was changed as part of "fix everything".

- [x] **#8 🟠 Reactivating an account brought old sessions back** ✅
  - Now: deactivating signs the account out everywhere, and reactivating doesn't bring old sessions back.

- [x] **#9 🟠 Teacher emails were public on course pages** ✅
  - Now: visitors and students see only the teacher's name. The course owner and admins still see the email.

- [x] **#10 🟠 Lowering an assignment's total marks broke percentages** ✅
  - Now: the total can't go below a mark already given. The message says why.

- [x] **#11 🟠 Quiz questions could be changed after students took it** ✅
  - Now: once taken, questions, options and right answers can't be added, removed or changed. Fixing the wording is still allowed.

- [x] **#12 🟠 Unsaved lesson notes could pass to the next user on a shared computer** ✅
  - Now: unsaved drafts are kept per user and cleared on sign-out, and so are in-progress quiz answers.

## Step 3: cleanup (🟡)

- [x] **#15 🟡 The catalog loaded every course's full cover image** ✅
  - Now: cover images load only for the courses on the page being shown.

- [x] **#16 🟡 Score % was worked out two different ways** ✅
  - Now: one shared rule is used everywhere.

- [x] **#17 🟡 A comment said something the code didn't do** ✅
  - Now: the comment is corrected. Teachers who own courses can be deactivated, but not deleted.

- [x] **#18 🟡 No email check at sign-up; bad input crashed** ✅
  - Now: one shared name and email check is used for sign-up, profile edits, adding a user and imports. Bad input gets a clear message instead of a crash.

- [x] **#19 🟡 Notes accepted any key** ✅
  - Now: notes only save against a real lesson in that course.

- [x] **#20 🟡 The server started without `JWT_SECRET`** ✅
  - Now: it refuses to start and says why.

- [x] **#21 🟡 No automated tests** ✅
  - Now: `server/test/api.test.js` has 22 checks covering the fixes above. Run them with `npm test` in the `server` folder.
