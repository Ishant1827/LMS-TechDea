import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { Bar, CenterLoader } from "../components/Bits";

export default function CourseEnrollments() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get(`/courses/${id}/enrollments`)
      .then((r) => setData(r.data))
      .catch(() => setData({ error: true }));
  }, [id]);

  if (!data)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (data.error)
    return (
      <Layout>
        <h3>Not available</h3>
        <Link className="btn btn-secondary" to="/manage" style={{ width: "fit-content" }}>
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
