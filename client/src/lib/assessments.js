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

// "in 3 days" / "2 days ago" / "today"
export function dueLabel(d) {
  if (!d) return "";
  const ms = new Date(d) - new Date();
  const days = Math.round(ms / 86400000);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return `due in ${days} days`;
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
