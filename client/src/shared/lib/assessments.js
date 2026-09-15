import { ClipboardList, ListChecks } from "lucide-react";

export const KIND_META = {
  assignment: { label: "Assignment", Icon: ClipboardList },
  quiz: { label: "Quiz", Icon: ListChecks },
};
export const kindMeta = (k) => KIND_META[k] || KIND_META.assignment;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

const startOfDay = (x) => {
  const d = new Date(x);
  d.setHours(0, 0, 0, 0);
  return d;
};

// "due in 3 days" / "2 days overdue" / "due today"
// Whether it's late is decided on the real instant, so this never contradicts
// isOverdue(); the count is in calendar days, which is what "in 3 days" means.
// (Math.round absorbs the 23/25-hour days around a DST change.)
export function dueLabel(d) {
  if (!d) return "";
  const now = new Date();
  const target = new Date(d);
  const dayGap = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);

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
export function submissionState(sub) {
  if (!sub) return "todo";
  return sub.status === "graded" ? "graded" : "submitted";
}

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
