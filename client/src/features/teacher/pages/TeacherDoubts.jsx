import { useEffect, useMemo, useState } from "react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader } from "@/shared/components/ui";
import Select from "@/shared/components/ui/Select";
import { useToast } from "@/shared/context/ToastContext";

const STATUS_TAG = { open: "tag-outline", answered: "tag-accent", resolved: "tag-neutral" };
const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function DoubtCard({ d, onSave }) {
  const [answer, setAnswer] = useState(d.answer || "");
  const [busy, setBusy] = useState(false);

  const save = async (patch) => {
    setBusy(true);
    await onSave(d._id, patch);
    setBusy(false);
  };

  return (
    <div className="card elev-sm" style={{ marginBottom: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <strong style={{ fontSize: 13 }}>{d.student?.name || "Student"}</strong>
        <span className="muted-sm" style={{ flex: 1, minWidth: 0 }}>
          {d.course?.title}
          {d.lesson?.title ? ` · ${d.lesson.title}` : ""} · {fmtDate(d.createdAt)}
        </span>
        <span className={"tag " + (STATUS_TAG[d.status] || "tag-neutral")} style={{ flex: "none" }}>
          {d.status}
        </span>
      </div>

      <p style={{ fontSize: 14, margin: "8px 0 10px" }}>{d.text}</p>

      <textarea
        className="input"
        style={{ minHeight: 70 }}
        placeholder="Write your answer…"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />
      <div className="chip-row" style={{ marginTop: 8 }}>
        <button
          className={"btn btn-primary" + (busy ? " is-loading" : "")}
          disabled={!answer.trim()}
          onClick={() => save({ answer })}
        >
          {d.answer ? "Update answer" : "Post answer"}
        </button>
        {d.status !== "resolved" ? (
          <button className="btn btn-secondary" onClick={() => save({ status: "resolved" })}>
            Mark resolved
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => save({ status: "open" })}>
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}

export default function TeacherDoubts() {
  const toast = useToast();
  const [doubts, setDoubts] = useState(null);
  const [tab, setTab] = useState("open");
  const [courseId, setCourseId] = useState("");

  const load = () =>
    api
      .get("/doubts/teaching")
      .then((r) => setDoubts(r.data.doubts))
      .catch(() => setDoubts([]));

  useEffect(() => {
    load();
  }, []);

  const save = async (id, patch) => {
    try {
      const { data } = await api.patch(`/doubts/${id}`, patch);
      setDoubts((ds) => ds.map((x) => (x._id === id ? data.doubt : x)));
      toast(patch.status === "resolved" ? "Marked resolved" : "Answer saved");
    } catch (e) {
      toast(e.message);
    }
  };

  const courses = useMemo(() => {
    const m = new Map();
    (doubts || []).forEach((d) => d.course && m.set(d.course._id, d.course.title));
    return [...m.entries()];
  }, [doubts]);

  if (!doubts)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  // Count within the current course filter, so the tab badges always describe
  // the list you're actually looking at.
  const inScope = doubts.filter((d) => !courseId || d.course?._id === courseId);
  const counts = inScope.reduce((a, d) => ((a[d.status] = (a[d.status] || 0) + 1), a), {});
  const shown = inScope.filter((d) => tab === "all" || d.status === tab);

  const Tab = ({ id, label }) => (
    <button
      className={"btn " + (tab === id ? "btn-primary" : "btn-ghost")}
      onClick={() => setTab(id)}
    >
      {label}
      {id !== "all" && counts[id] ? ` (${counts[id]})` : ""}
    </button>
  );

  return (
    <Layout>
      <h2 className="page-title">
        Doubts
        {counts.open ? <span className="text-muted" style={{ fontWeight: 600 }}> · {counts.open} open</span> : ""}
      </h2>

      <div className="row" style={{ marginBottom: 14, gap: 6 }}>
        <Tab id="open" label="Open" />
        <Tab id="answered" label="Answered" />
        <Tab id="resolved" label="Resolved" />
        <Tab id="all" label="All" />
        {courses.length > 1 && (
          <div style={{ maxWidth: 220, marginLeft: "auto", width: "100%" }}>
            <Select
              aria-label="Filter by course"
              value={courseId}
              onChange={setCourseId}
              options={[
                { value: "", label: "All courses" },
                ...courses.map(([cid, title]) => ({ value: cid, label: title })),
              ]}
            />
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="muted-sm">Nothing here.</p>
      ) : (
        <div style={{ maxWidth: 760 }}>
          {shown.map((d) => (
            <DoubtCard key={d._id} d={d} onSave={save} />
          ))}
        </div>
      )}
    </Layout>
  );
}
