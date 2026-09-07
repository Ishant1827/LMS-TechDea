import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Users, Trash2, Plus, Pencil } from "lucide-react";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader } from "../components/Bits";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

export default function ManageCourses() {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState(null);

  const load = () =>
    api
      .get("/courses/manage")
      .then((r) => setList(r.data.courses))
      .catch(() => setList([]));

  useEffect(() => {
    load();
  }, []);

  const togglePublish = async (c) => {
    try {
      const { data } = await api.patch(`/courses/${c._id}/publish`, { published: !c.published });
      setList((l) => l.map((x) => (x._id === c._id ? { ...x, published: data.course.published } : x)));
      toast(data.course.published ? "Course published" : "Moved to draft");
    } catch (e) {
      toast(e.message);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.title}" and all its lessons?`)) return;
    try {
      await api.delete(`/courses/${c._id}`);
      setList((l) => l.filter((x) => x._id !== c._id));
      toast("Course deleted");
    } catch (e) {
      toast(e.message);
    }
  };

  if (!list)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  return (
    <Layout>
      <div className="row" style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>
          {user.role === "admin" ? "All Courses" : "My Courses"}
          {list.length > 0 && <span className="text-muted" style={{ fontWeight: 600 }}> · {list.length}</span>}
        </h2>
        <Link className="btn btn-primary" to="/manage/courses/new" style={{ marginLeft: "auto" }}>
          <Plus />
          New Course
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="card elev-sm" style={{ alignItems: "flex-start" }}>
          <div className="card-title">No courses yet</div>
          <div className="card-meta" style={{ marginBottom: 10 }}>
            Create your first course and add some lessons.
          </div>
          <Link className="btn btn-primary" to="/manage/courses/new">
            <Plus />
            New Course
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th className="t-num">Lessons</th>
                <th className="t-num">Students</th>
                <th className="t-status">Status</th>
                <th className="t-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c._id}>
                  <td>
                    <span className="t-primary">
                      <Link to={`/manage/courses/${c._id}`}>{c.title}</Link>
                      <span className="t-sub">
                        {user.role === "admin" && `${c.owner?.name || "Unassigned"} · `}
                        Updated {shortDate(c.updatedAt)}
                      </span>
                    </span>
                  </td>
                  <td className="t-num">{c.lessonCount}</td>
                  <td className="t-num">{c.enrollmentCount}</td>
                  <td className="t-status">
                    <span className={"tag " + (c.published ? "tag-accent" : "tag-neutral")}>
                      {c.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="t-actions">
                    <span className="act-group">
                      <Link
                        className="btn btn-secondary"
                        to={`/manage/courses/${c._id}`}
                        title="Edit course"
                      >
                        <Pencil />
                        Edit
                      </Link>
                      <button
                        className="btn btn-secondary act-toggle"
                        onClick={() => togglePublish(c)}
                      >
                        {c.published ? <EyeOff /> : <Eye />}
                        {c.published ? "Unpublish" : "Publish"}
                      </button>
                      <Link
                        className="btn btn-ghost"
                        to={`/manage/courses/${c._id}/enrollments`}
                        title="View enrolled students"
                      >
                        <Users />
                        Students
                      </Link>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ color: "var(--color-danger)" }}
                        onClick={() => remove(c)}
                        title="Delete course"
                        aria-label="Delete course"
                      >
                        <Trash2 />
                      </button>
                    </span>
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
