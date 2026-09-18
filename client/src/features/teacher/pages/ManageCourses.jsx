import { Link } from "react-router-dom";
import { Eye, EyeOff, Users, Trash2, Plus, Pencil } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, ErrorState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { useAuth } from "@/features/auth/AuthContext";
import { useIsNarrow } from "@/shared/hooks/useMediaQuery";

const shortDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

export default function ManageCourses() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const narrow = useIsNarrow();
  const {
    status,
    data: list,
    error,
    reload,
    setData: setList,
  } = useLoad(() => api.get("/courses/manage").then((r) => r.data.courses));

  const togglePublish = async (c) => {
    try {
      const { data } = await api.patch(`/courses/${c._id}/publish`, { published: !c.published });
      setList((l) => l.map((x) => (x._id === c._id ? { ...x, published: data.course.published } : x)));
      toast(data.course.published ? "Course published" : "Moved to draft");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const remove = async (c) => {
    // Spell out everything the server cascade actually destroys — the old
    // prompt only mentioned lessons, but enrolments and grades go too.
    const also = [
      c.lessonCount ? `${c.lessonCount} lesson${c.lessonCount === 1 ? "" : "s"}` : null,
      c.enrollmentCount
        ? `${c.enrollmentCount} student enrolment${c.enrollmentCount === 1 ? "" : "s"} and their progress`
        : null,
      "every assignment, quiz and graded submission on it",
    ].filter(Boolean);

    const ok = await confirm({
      title: "Delete this course?",
      message: `"${c.title}" will be permanently deleted.`,
      detail: `This also deletes ${also.join(", ")}. This can't be undone.`,
      confirmLabel: "Delete course",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/courses/${c._id}`);
      setList((l) => l.filter((x) => x._id !== c._id));
      toast("Course deleted");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (status === "loading")
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  if (status === "error")
    return (
      <Layout>
        <h2 className="page-title">Manage Courses</h2>
        <ErrorState title="Couldn't load your courses" message={error.message} onRetry={reload} />
      </Layout>
    );

  return (
    <Layout>
      <div className="row manage-head" style={{ marginBottom: 18 }}>
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
      ) : narrow ? (
        /* On a phone the 5-column table pushed every action button off-screen,
           so each course becomes a self-contained card instead. */
        <div className="mcard-list">
          {list.map((c) => (
            <article key={c._id} className="mcard card elev-sm">
              <div className="mcard-top">
                <Link className="mcard-title" to={`/manage/courses/${c._id}`}>
                  {c.title}
                </Link>
                <span className={"tag " + (c.published ? "tag-accent" : "tag-neutral")}>
                  {c.published ? "Published" : "Draft"}
                </span>
              </div>

              <div className="mcard-sub">
                {user.role === "admin" && `${c.owner?.name || "Unassigned"} · `}
                Updated {shortDate(c.updatedAt)}
              </div>

              <div className="mcard-stats">
                <div>
                  <b>{c.lessonCount}</b>
                  <span>{c.lessonCount === 1 ? "Lesson" : "Lessons"}</span>
                </div>
                <div>
                  <b>{c.enrollmentCount}</b>
                  <span>{c.enrollmentCount === 1 ? "Student" : "Students"}</span>
                </div>
              </div>

              <div className="mcard-actions">
                <Link className="btn btn-secondary" to={`/manage/courses/${c._id}`}>
                  <Pencil />
                  Edit
                </Link>
                <button className="btn btn-secondary" onClick={() => togglePublish(c)}>
                  {c.published ? <EyeOff /> : <Eye />}
                  {c.published ? "Unpublish" : "Publish"}
                </button>
                <Link className="btn btn-secondary" to={`/manage/courses/${c._id}/enrollments`}>
                  <Users />
                  Students
                </Link>
                <button
                  className="btn btn-secondary mcard-del"
                  onClick={() => remove(c)}
                  aria-label={`Delete ${c.title}`}
                >
                  <Trash2 />
                  Delete
                </button>
              </div>
            </article>
          ))}
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
