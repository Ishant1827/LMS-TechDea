import { ClipboardList, ListChecks } from "lucide-react";

const KIND_META = {
  assignment: { label: "Assignment", Icon: ClipboardList },
  quiz: { label: "Quiz", Icon: ListChecks },
};
export const kindMeta = (k) => KIND_META[k] || KIND_META.assignment;

/* ── Dates ─────────────────────────────────────────────────────────────────
 * Deadlines are Indian time, for everyone. A teacher who sets "Oct 15, 5:00 PM"
 * means 5:00 PM IST, and that is one instant no matter what clock the student's
 * device is set to. So nothing here reads the browser's timezone: the offset is
 * pinned at +05:30, which stays exact because India has no daylight saving.
 */
const IST = "Asia/Kolkata";
const IST_MS = 5.5 * 60 * 60 * 1000;

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        timeZone: IST,
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

// "IST" is spelled out because a due time that does not say which clock it is
// on is a due time somebody will get wrong.
export const fmtDateTime = (d) =>
  d
    ? `${new Date(d).toLocaleString(undefined, {
        timeZone: IST,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })} IST`
    : "";

// What <input type="datetime-local"> wants — "YYYY-MM-DDTHH:mm", read in IST.
export const istInputValue = (d) =>
  d ? new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 16) : "";

// The reverse. What the teacher typed is IST, not their own clock, so it is
// stamped +05:30 on the way to becoming a real instant. null if unparseable.
export const istToInstant = (s) => {
  if (!s) return null;
  const d = new Date(`${s.length === 16 ? `${s}:00` : s}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Which IST calendar day an instant falls on, as whole days since the epoch —
// so the gap between two of them is exact, with no DST to absorb.
const istDay = (x) => Math.floor((new Date(x).getTime() + IST_MS) / 86400000);

// "due in 3 days" / "2 days overdue" / "due today"
// Whether it's late is decided on the real instant, so this never contradicts
// isOverdue(); the count is in IST calendar days, which is what "in 3 days"
// means to a student reading it.
export function dueLabel(d) {
  if (!d) return "";
  const now = new Date();
  const target = new Date(d);
  const dayGap = istDay(target) - istDay(now);

  if (target < now) {
    if (dayGap === 0) return "overdue";
    return dayGap === -1 ? "1 day overdue" : `${-dayGap} days overdue`;
  }
  if (dayGap === 0) return "due today";
  if (dayGap === 1) return "due tomorrow";
  return `due in ${dayGap} days`;
}
export const isOverdue = (d) => !!d && new Date(d) < new Date();

// One of: "todo" | "submitted" | "graded"
//
// Work the teacher sent back counts as "todo": it is the student's move again,
// so it belongs with the things they still have to do, not with what they have
// handed in. `isReturned` is what tells the two apart on screen.
export function submissionState(sub) {
  if (!sub || sub.status === "returned") return "todo";
  return sub.status === "graded" ? "graded" : "submitted";
}

export const isReturned = (sub) => sub?.status === "returned";

export const STATE_TAG = {
  todo: "tag-outline",
  submitted: "tag-accent",
  graded: "tag-neutral",
};
export const STATE_LABEL = {
  todo: "To do",
  submitted: "Submitted",
  graded: "Graded",
};
