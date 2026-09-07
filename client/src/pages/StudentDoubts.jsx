import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader } from "../components/Bits";

const STATUS_TAG = {
  open: "tag-outline",
  answered: "tag-accent",
  resolved: "tag-neutral",
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function StudentDoubts() {
  const [doubts, setDoubts] = useState(null);

  useEffect(() => {
    api
      .get("/doubts/mine")
      .then((r) => setDoubts(r.data.doubts))
      .catch(() => setDoubts([]));
  }, []);

  if (!doubts)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  return (
    <Layout>
      <h2 className="page-title">Doubts</h2>

      {doubts.length === 0 ? (
        <div className="card elev-sm" style={{ alignItems: "flex-start" }}>
          <div className="card-title">No doubts yet</div>
          <div className="card-meta" style={{ marginBottom: 10 }}>
            Open a lesson and use “Ask a doubt” to send a question to your teacher.
          </div>
          <Link className="btn btn-primary" to="/my-learning">
            Go to My Learning
          </Link>
        </div>
      ) : (
        doubts.map((d) => (
          <div key={d._id} className="card elev-sm" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className="card-kicker" style={{ color: "var(--color-muted)" }}>
                {d.course?.title || "Course"}
                {d.lesson?.title ? ` · ${d.lesson.title}` : ""}
              </span>
              <span className={"tag " + (STATUS_TAG[d.status] || "tag-neutral")} style={{ marginLeft: "auto" }}>
                {d.status}
              </span>
            </div>
            <p style={{ fontSize: 14, margin: "6px 0 0" }}>{d.text}</p>
            <div className="muted-sm">Asked {fmtDate(d.createdAt)}</div>

            {d.answer && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid var(--color-divider)",
                }}
              >
                <div className="card-kicker">
                  Answer{d.answeredBy?.name ? ` · ${d.answeredBy.name}` : ""}
                </div>
                <p style={{ fontSize: 13, margin: "4px 0 0" }}>{d.answer}</p>
              </div>
            )}
          </div>
        ))
      )}
    </Layout>
  );
}
