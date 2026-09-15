import { useEffect, useState } from "react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { Bar, CenterLoader } from "@/shared/components/ui";

export default function ProgressPage() {
  const [list, setList] = useState(null);

  useEffect(() => {
    api
      .get("/enrollments/mine")
      .then((r) => setList(r.data.enrollments))
      .catch(() => setList([]));
  }, []);

  if (!list)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  const done = list.reduce((s, e) => s + e.completed, 0);
  const total = list.reduce((s, e) => s + e.total, 0);
  const overall = total ? Math.round((done / total) * 100) : 0;

  return (
    <Layout>
      <h4 className="page-title">Progress</h4>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card elev-sm stat">
          <div className="card-title">{overall}%</div>
          <div className="card-meta">Overall Progress</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">
            {done}/{total}
          </div>
          <div className="card-meta">Lessons Completed</div>
        </div>
        <div className="card elev-sm stat">
          <div className="card-title">{list.length}</div>
          <div className="card-meta">Courses Enrolled</div>
        </div>
      </div>

      <h5 className="section-h">Course-wise Progress</h5>
      {list.length ? (
        list.map((e) => (
          <div
            key={e._id}
            className="card elev-sm"
            style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}
          >
            <div style={{ flex: 1 }}>
              <div className="card-title" style={{ fontSize: 14 }}>
                {e.course.title}
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar value={e.percent} />
              </div>
            </div>
            <span style={{ fontSize: 13 }}>{e.percent}%</span>
          </div>
        ))
      ) : (
        <p className="muted-sm">Enrol in a course to start tracking progress.</p>
      )}
    </Layout>
  );
}
