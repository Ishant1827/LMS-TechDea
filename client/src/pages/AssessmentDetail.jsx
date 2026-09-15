import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader } from "../components/Bits";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { kindMeta, fmtDateTime } from "../lib/assessments";
import { safeUrl } from "../lib/safeUrl";

const qCount = (n) => `${n} question${n === 1 ? "" : "s"}`;

/* ── banner shown once a submission exists ───────────────────────────────── */
function ResultBanner({ a, sub }) {
  if (!sub) return null;

  if (sub.status !== "graded") {
    return (
      <div className="result-banner is-pending">
        <Clock />
        <div>
          <div className="rb-label">Submitted {fmtDateTime(sub.submittedAt)}</div>
          <div style={{ fontSize: 12 }}>Waiting on your teacher to grade it.</div>
        </div>
      </div>
    );
  }

  const fail = sub.passed === false;
  const scoreText =
    a.kind === "quiz"
      ? `${sub.percent}%`
      : `${sub.score ?? "—"} / ${a.points}${sub.percent != null ? `  ·  ${sub.percent}%` : ""}`;

  return (
    <div className={"result-banner" + (fail ? " is-fail" : "")}>
      {fail ? <XCircle /> : <CheckCircle2 />}
      <div>
        <div className="rb-score">{scoreText}</div>
        <div className="rb-label">
          {a.kind === "quiz" && sub.passed != null
            ? sub.passed
              ? "Passed"
              : `Below the ${a.passPercent}% pass mark`
            : "Graded"}
        </div>
      </div>
    </div>
  );
}

/* ── read-only quiz review (answers vs key) ──────────────────────────────── */
function QuizReview({ questions, answers }) {
  return (
    <ol className="qz-qs">
      {questions.map((q, i) => (
        <li key={q._id || i} className="qz-q">
          <div className="qz-q-head">
            <span className="qz-q-num">{i + 1}</span>
            <span className="qz-q-text">{q.text}</span>
          </div>
          <div className="qz-opts">
            {q.options.map((opt, oi) => {
              const picked = answers[i] === oi;
              const correct = q.correctIndex === oi;
              return (
                <div
                  key={oi}
                  className={
                    "qz-opt is-static" +
                    (correct ? " is-correct" : "") +
                    (picked && !correct ? " is-wrong" : "")
                  }
                >
                  {correct ? (
                    <CheckCircle2 className="mark-ic" />
                  ) : picked ? (
                    <XCircle className="mark-ic" />
                  ) : (
                    <span className="mark" />
                  )}
                  {opt}
                  {picked && <span className="tag-you">Your answer</span>}
                </div>
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── take / submit ─────────────────────────────────────────────────────── */
function AttemptForm({ a, onDone }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [answers, setAnswers] = useState(() => (a.questions || []).map(() => -1));
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(a.kind === "quiz" && a.timeLimitMin ? a.timeLimitMin * 60 : 0);
  const submittedRef = useRef(false);

  const total = (a.questions || []).length;
  const answered = answers.filter((v) => v >= 0).length;

  const send = async (auto = false) => {
    if (submittedRef.current) return;
    if (a.kind === "assignment" && !text.trim() && !link.trim()) {
      toast("Write an answer or paste a link first");
      return;
    }
    if (!auto && a.kind === "quiz" && answered < total) {
      const left = total - answered;
      const ok = await confirm({
        title: "Submit with unanswered questions?",
        message: `${left} question${left === 1 ? "" : "s"} still unanswered.`,
        detail: "You get one attempt, so unanswered questions will be marked wrong.",
        confirmLabel: "Submit anyway",
        danger: true,
      });
      if (!ok) return;
    }
    submittedRef.current = true;
    setBusy(true);
    try {
      const body = a.kind === "assignment" ? { text, link } : { answers };
      const { data } = await api.post(`/assessments/${a._id}/submit`, body);
      toast(auto ? "Time's up — quiz submitted" : a.kind === "quiz" ? "Quiz submitted" : "Assignment submitted");
      onDone(data.submission);
    } catch (e) {
      submittedRef.current = false;
      toast(e.message);
      setBusy(false);
    }
  };

  useEffect(() => {
    if (a.kind !== "quiz" || !a.timeLimitMin) return;
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          send(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <>
      {a.kind === "quiz" && a.timeLimitMin > 0 && (
        <div className={"qz-timerbar" + (left <= 30 ? " is-low" : "")}>
          <span className="qz-timer">
            <Clock /> {mm}:{ss}
          </span>
          <span className="qz-progress">
            {answered} / {total} answered
          </span>
        </div>
      )}

      {a.instructions && <p className="prompt-body">{a.instructions}</p>}

      {a.kind === "assignment" ? (
        <>
          <div className="field">
            <label>Your answer</label>
            <textarea
              className="input"
              style={{ minHeight: 180 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your response…"
            />
          </div>
          <div className="field">
            <label>
              Link <span className="text-muted">(optional — Google Doc, GitHub, Figma…)</span>
            </label>
            <input
              className="input"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </>
      ) : (
        <ol className="qz-qs">
          {(a.questions || []).map((q, i) => (
            <li key={q._id || i} className="qz-q">
              <div className="qz-q-head">
                <span className="qz-q-num">{i + 1}</span>
                <span className="qz-q-text">{q.text}</span>
              </div>
              <div className="qz-opts">
                {q.options.map((opt, oi) => (
                  <label key={oi} className={"qz-opt" + (answers[i] === oi ? " is-chosen" : "")}>
                    <input
                      type="radio"
                      name={`q${i}`}
                      checked={answers[i] === oi}
                      onChange={() => setAnswers((prev) => prev.map((v, x) => (x === i ? oi : v)))}
                    />
                    <span className="mark" />
                    {opt}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="asmt-submitbar">
        <button
          className={"btn btn-primary" + (busy ? " is-loading" : "")}
          disabled={busy}
          onClick={() => send(false)}
        >
          {a.kind === "quiz" ? "Submit quiz" : "Submit assignment"}
        </button>
        {a.kind === "quiz" && (
          <span className="muted-sm">One attempt only — you can't change answers after this.</span>
        )}
      </div>
    </>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */
export default function AssessmentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null); // { a, sub } | { error }

  const fetchOne = () =>
    api
      .get(`/assessments/${id}`)
      .then((r) => setData({ a: r.data.assessment, sub: r.data.submission }))
      .catch(() => setData({ error: true }));

  useEffect(() => {
    setData(null);
    fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A quiz's answer key is only revealed after an attempt — re-fetch so the
  // review renders correctly.
  const finish = () => fetchOne();

  if (!data)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (data.error)
    return (
      <Layout>
        <button className="back" onClick={() => nav("/assignments")}>
          <ArrowLeft /> Assignments
        </button>
        <p className="muted-sm">Couldn't load this — it may have been removed or unpublished.</p>
      </Layout>
    );

  const { a, sub } = data;
  const { label } = kindMeta(a.kind);

  return (
    <Layout>
      <button className="back" onClick={() => nav("/assignments")} style={{ marginBottom: 14 }}>
        <ArrowLeft /> Assignments
      </button>

      <div className="asmt-detail-head">
        <span className="tag tag-neutral">{label}</span>
        <h2>{a.title}</h2>
        <div className="asmt-card-meta">
          <span>{a.course?.title}</span>
          {a.kind === "quiz" && a.questionCount ? (
            <>
              <span>·</span>
              <span>{qCount(a.questionCount)}</span>
            </>
          ) : null}
          {a.kind === "quiz" && a.timeLimitMin ? (
            <>
              <span>·</span>
              <span>{a.timeLimitMin} min limit</span>
            </>
          ) : null}
          {a.kind === "assignment" ? (
            <>
              <span>·</span>
              <span>{a.points} marks</span>
            </>
          ) : null}
          {a.dueAt && (
            <>
              <span>·</span>
              <span>due {fmtDateTime(a.dueAt)}</span>
            </>
          )}
        </div>
      </div>

      <ResultBanner a={a} sub={sub} />

      {!sub ? (
        <AttemptForm a={a} onDone={finish} />
      ) : a.kind === "quiz" ? (
        <>
          {a.instructions && <p className="prompt-body">{a.instructions}</p>}
          {a.questions?.length ? <QuizReview questions={a.questions} answers={sub.answers || []} /> : null}
          {sub.feedback && (
            <div className="fb-box">
              <div className="fb-label">Teacher feedback</div>
              <p>{sub.feedback}</p>
            </div>
          )}
        </>
      ) : (
        <>
          {a.instructions && <p className="prompt-body">{a.instructions}</p>}
          <div className="field">
            <label>Your submission</label>
            <div className={"asmt-answer" + (sub.text ? "" : " is-empty")}>
              {sub.text || "No written answer"}
            </div>
          </div>
          {safeUrl(sub.link) && (
            <p style={{ fontSize: 13 }}>
              Link:{" "}
              <a href={safeUrl(sub.link)} target="_blank" rel="noreferrer">
                {sub.link}
              </a>
            </p>
          )}
          {sub.feedback && (
            <div className="fb-box">
              <div className="fb-label">Teacher feedback</div>
              <p>{sub.feedback}</p>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
