import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ArrowRight } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import {
  kindMeta,
  dueLabel,
  isOverdue,
  submissionState,
  isReturned,
  STATE_TAG,
  STATE_LABEL,
} from "@/shared/lib/assessments";

const TABS = ["todo", "submitted", "graded", "all"];
const qCount = (n) => `${n} question${n === 1 ? "" : "s"}`;

export default function StudentAssignments() {
  const [tab, setTab] = useState("todo");
  const { status, data: items, error, reload } = useLoad(() =>
    api.get("/assessments/mine").then((r) => r.data.assessments)
  );

  const { counts, avg } = useMemo(() => {
    const c = { todo: 0, submitted: 0, graded: 0 };
    const scores = [];
    (items || []).forEach((it) => {
      c[submissionState(it.submission)] += 1;
      if (it.submission?.status === "graded" && it.submission.percent != null) {
        scores.push(it.submission.percent);
      }
    });
    return {
      counts: c,
      avg: scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null,
    };
  }, [items]);

  if (status === "loading")
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (status === "error")
    return (
      <Layout>
        <div className="asmt-head">
          <h2>Assignments &amp; Quizzes</h2>
        </div>
        <ErrorState
          title="Couldn't load your assignments"
          message={error.message}
          onRetry={reload}
        />
      </Layout>
    );

  const shown = tab === "all" ? items : items.filter((it) => submissionState(it.submission) === tab);

  return (
    <Layout>
      <div className="asmt-head">
        <div>
          <h2>Assignments &amp; Quizzes</h2>
          <div className="asmt-sub">Everything set by the courses you're enrolled in.</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card elev-sm" style={{ alignItems: "flex-start" }}>
          <div className="card-title">Nothing assigned yet</div>
          <div className="card-meta" style={{ marginBottom: 10 }}>
            When a course you're enrolled in adds an assignment or quiz, it shows up here.
          </div>
          <Link className="btn btn-primary" to="/my-learning">
            Go to My Learning <ArrowRight />
          </Link>
        </div>
      ) : (
        <>
          <div className="stat-strip">
            <div className="card elev-sm stat">
              <div className="card-title">{counts.todo}</div>
              <div className="card-meta">To do</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{counts.submitted}</div>
              <div className="card-meta">Awaiting grade</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{counts.graded}</div>
              <div className="card-meta">Graded</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{avg == null ? "—" : `${avg}%`}</div>
              <div className="card-meta">Average score</div>
            </div>
          </div>

          <div className="seg-wrap">
            <div className="seg" role="tablist">
              {TABS.map((id) => (
                <label className="seg-opt" key={id}>
                  <input
                    type="radio"
                    name="asmt-tab"
                    checked={tab === id}
                    onChange={() => setTab(id)}
                  />
                  {STATE_LABEL[id] || "All"}
                  {id !== "all" && counts[id] ? ` (${counts[id]})` : ""}
                </label>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="muted-sm">Nothing in this tab.</p>
          ) : (
            <div className="asmt-list">
              {shown.map((it) => {
                const { Icon, label } = kindMeta(it.kind);
                const state = submissionState(it.submission);
                const overdue = state === "todo" && isOverdue(it.dueAt);
                return (
                  <Link
                    key={it._id}
                    to={`/assignments/${it._id}`}
                    className="card elev-sm clickable asmt-card plain"
                  >
                    <span className="ic">
                      <Icon />
                    </span>
                    <span className="asmt-card-main">
                      <span className="asmt-card-title">{it.title}</span>
                      <span className="asmt-card-meta">
                        <span>{label}</span>
                        <span>·</span>
                        <span>{it.course?.title}</span>
                        {it.kind === "quiz" && it.questionCount ? (
                          <>
                            <span>·</span>
                            <span>{qCount(it.questionCount)}</span>
                          </>
                        ) : null}
                        {it.dueAt && (
                          <>
                            <span>·</span>
                            <span className={"due-chip" + (overdue ? " is-overdue" : "")}>
                              <CalendarClock />
                              {dueLabel(it.dueAt)}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="asmt-card-end">
                      {state === "graded" && it.submission?.percent != null && (
                        <span
                          className={
                            "asmt-score" +
                            (it.submission.passed === false
                              ? " is-fail"
                              : it.submission.passed
                              ? " is-pass"
                              : "")
                          }
                        >
                          {it.submission.percent}%
                        </span>
                      )}
                      {/* Sent-back work sits in "To do", but it is not the same
                          as never started — the tag says which it is. */}
                      {isReturned(it.submission) ? (
                        <span className="tag tag-accent">Sent back</span>
                      ) : (
                        <span className={"tag " + STATE_TAG[state]}>{STATE_LABEL[state]}</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
