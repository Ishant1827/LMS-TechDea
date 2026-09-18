import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { Bar, CenterLoader, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useIsNarrow } from "@/shared/hooks/useMediaQuery";

export default function CourseEnrollments() {
  const { id } = useParams();
  const narrow = useIsNarrow();
  const { status, data, error, reload } = useLoad(
    () => api.get(`/courses/${id}/enrollments`).then((r) => r.data),
    [id]
  );

  if (status === "loading")
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (status === "error")
    return (
      <Layout>
        {error.status === 404 || error.status === 403 ? (
          <>
            <h3>Not available</h3>
            <p className="text-muted">This course isn't yours, or no longer exists.</p>
          </>
        ) : (
          <ErrorState
            title="Couldn't load enrolments"
            message={error.message}
            onRetry={reload}
          />
        )}
        <Link className="btn btn-secondary" to="/manage" style={{ width: "fit-content", marginTop: 14 }}>
          Back
        </Link>
      </Layout>
    );

  return (
    <Layout>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link className="back" to="/manage">
          <ArrowLeft />
          Courses
        </Link>
        <h2 style={{ margin: 0 }}>{data.course.title} — Students</h2>
      </div>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        {data.enrollments.length} enrolled · {data.total} lessons
      </p>

      {data.enrollments.length === 0 ? (
        <p className="muted-sm">No one has enrolled yet.</p>
      ) : narrow ? (
        /* The 4-column table clipped the progress figures on a phone. */
        <div className="mcard-list">
          {data.enrollments.map((e) => (
            <article key={e._id} className="mcard card elev-sm">
              <div className="mcard-top">
                <span className="mcard-title" style={{ cursor: "default" }}>
                  {e.student.name}
                </span>
                <span className="muted-sm" style={{ flex: "none" }}>
                  {e.percent}%
                </span>
              </div>
              <div className="mcard-sub">{e.student.email}</div>
              <div style={{ margin: "10px 0 6px" }}>
                <Bar value={e.percent} />
              </div>
              <div className="muted-sm">
                {e.completed} of {e.total} lesson{e.total === 1 ? "" : "s"} complete
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Progress</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.enrollments.map((e) => (
              <tr key={e._id}>
                <td style={{ fontWeight: 700 }}>{e.student.name}</td>
                <td className="text-muted">{e.student.email}</td>
                <td style={{ minWidth: 160 }}>
                  <Bar value={e.percent} />
                </td>
                <td>
                  {e.completed}/{e.total} · {e.percent}%
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
