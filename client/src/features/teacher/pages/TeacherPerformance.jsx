import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader } from "@/shared/components/ui";
import Select from "@/shared/components/ui/Select";

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
          <div style={{ maxWidth: 260, marginLeft: "auto", width: "100%" }}>
            <Select
              aria-label="Course"
              value={courseId}
              onChange={setCourseId}
              options={courses.map((c) => ({ value: c._id, label: c.title }))}
            />
          </div>
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
              <div className="card-title">{perf.active7}</div>
              <div className="card-meta">Active this week</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{perf.completionRate}%</div>
              <div className="card-meta">Finished the course</div>
            </div>
            <div className="card elev-sm stat">
              <div className="card-title">{perf.avgPercent}%</div>
              <div className="card-meta">Avg content progress</div>
            </div>
          </div>

          <h5 className="section-h">Assessment results</h5>
          {perf.assessments && perf.assessments.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th className="t-num">Submissions</th>
                    <th className="t-num">Avg score</th>
                    <th className="t-num">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.assessments.map((a) => (
                    <tr key={a._id}>
                      <td style={{ fontWeight: 700 }}>{a.title}</td>
                      <td className="t-num">{a.submissions}</td>
                      <td className="t-num">{a.avgScore}%</td>
                      <td className="t-num">{a.passRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card elev-sm" style={{ alignItems: "flex-start", maxWidth: 520 }}>
              <div className="ph" style={{ width: 42, height: 42, marginBottom: 8 }}>
                <ClipboardList />
              </div>
              <div className="card-title">Score students on assignments &amp; quizzes</div>
              <div className="card-meta" style={{ marginBottom: 10 }}>
                Once this course has assignments or quizzes, average scores, pass rates and per-student
                results will show here.
              </div>
              <Link className="btn btn-primary" to="/teach/assignments">
                Go to Assignments &amp; Quizzes
              </Link>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
