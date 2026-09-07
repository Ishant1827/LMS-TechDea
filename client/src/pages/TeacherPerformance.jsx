import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader } from "../components/Bits";

export default function TeacherPerformance() {
  const [courses, setCourses] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    api
      .get("/courses/manage")
      .then((r) => {
        setCourses(r.data.courses);
        if (r.data.courses[0]) setCourseId(r.data.courses[0]._id);
      })
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!courseId) return;
    setPerf(null);
    api
      .get(`/courses/${courseId}/performance`)
      .then((r) => setPerf(r.data))
      .catch(() => setPerf({ error: true }));
  }, [courseId]);

  if (!courses)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  return (
    <Layout>
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Performance</h2>
        {courses.length > 0 && (
          <select
            className="input"
            style={{ maxWidth: 260, marginLeft: "auto" }}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {courses.length === 0 ? (
        <p className="text-muted">Create a course first.</p>
      ) : !perf ? (
        <CenterLoader />
      ) : perf.error ? (
        <p className="text-muted">Couldn't load performance.</p>
      ) : perf.enrolled === 0 ? (
        <p className="muted-sm">No one has enrolled in this course yet.</p>
      ) : (
        <>
          <div className="stat-strip">
            <div className="card elev-sm stat">
              <div className="card-title">{perf.enrolled}</div>
              <div className="card-meta">Enrolled</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{perf.completionRate}%</div>
              <div className="card-meta">Completed the course</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{perf.avgPercent}%</div>
              <div className="card-meta">Avg progress</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{perf.active7}</div>
              <div className="card-meta">Active this week</div>
            </div>
          </div>

          {perf.dropOff && (
            <div className="callout-warn">
              <AlertTriangle />
              <span>
                Biggest drop-off: <strong>{perf.dropOff.drop}</strong> student
                {perf.dropOff.drop === 1 ? "" : "s"} stop at <strong>{perf.dropOff.title}</strong>{" "}
                (after “{perf.dropOff.after}”).
              </span>
            </div>
          )}

          <h5 className="section-h">Completion funnel</h5>
          <div className="funnel">
            {perf.funnel.map((f) => (
              <div key={f.lessonId} className="funnel-row">
                <span className="funnel-label" title={f.title}>
                  {f.title}
                </span>
                <span className="funnel-track">
                  <span className="funnel-fill" style={{ width: `${f.pct}%` }} />
                </span>
                <span className="funnel-val">
                  {f.completed}
                  <span className="muted-sm">/{perf.enrolled}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
