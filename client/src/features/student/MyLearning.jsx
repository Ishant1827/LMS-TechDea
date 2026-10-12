import { Link } from "react-router-dom";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { Bar, CenterLoader, CourseThumb, ErrorState, EmptyState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";

export default function MyLearning() {
  const toast = useToast();
  const confirm = useConfirm();
  const {
    status,
    data: list,
    error,
    reload,
    setData: setList,
  } = useLoad(() =>
    api.get("/enrollments/mine").then((r) =>
      r.data.enrollments.slice().sort((a, b) => {
        const ad = a.percent >= 100 ? 1 : 0;
        const bd = b.percent >= 100 ? 1 : 0;
        return ad !== bd ? ad - bd : b.percent - a.percent;
      })
    ),
    [],
    { key: "my-learning" }
  );

  const leave = async (e) => {
    const ok = await confirm({
      title: "Leave this course?",
      message: `You'll be un-enrolled from "${e.course.title}".`,
      detail:
        e.completed > 0
          ? `Your progress (${e.completed} of ${e.total} lessons) and your notes for this course will be deleted. You can enrol again, but you'll start over.`
          : "You can enrol again at any time.",
      confirmLabel: "Leave course",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/enrollments/${e.course._id}`);
      setList((l) => l.filter((x) => x._id !== e._id));
      toast("Left the course");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  if (status === "loading")
    return (
      <Layout>
        <CenterLoader variant="grid" />
      </Layout>
    );

  if (status === "error")
    return (
      <Layout>
        <h2 className="page-title">My Learning</h2>
        <ErrorState title="Couldn't load your courses" message={error.message} onRetry={reload} />
      </Layout>
    );

  if (!list.length)
    return (
      <Layout>
        <h2 className="page-title">My Learning</h2>
        <EmptyState title="Start your first course" text="Every course in the catalog is free.">
          <Link className="btn btn-primary" to="/courses">
            Browse Courses
          </Link>
        </EmptyState>
      </Layout>
    );

  return (
    <Layout>
      <h2 className="page-title">My Learning</h2>
      <div className="grid-3">
        {list.map((e) => {
          const done = e.percent >= 100;
          return (
            <div key={e._id} className="card elev-sm">
              <CourseThumb src={e.course.thumbnailUrl} />
              <div className="row" style={{ gap: 8 }}>
                <div className="card-title" style={{ flex: 1 }}>
                  {e.course.title}
                </div>
                {e.status === "completed" && (
                  <span className="tag tag-accent" style={{ flex: "none" }}>
                    Completed
                  </span>
                )}
              </div>
              <div className="card-meta">Teacher: {e.course.teacherName || "—"}</div>
              <Bar value={e.percent} />
              <div className="card-meta">
                {done ? "Complete" : `${e.completed}/${e.total} lessons · ${e.percent}%`}
              </div>
              <Link
                className={"btn btn-block " + (done ? "btn-secondary" : "btn-primary")}
                style={{ justifyContent: "center" }}
                to={
                  e.currentLessonId
                    ? `/learn/${e.course._id}/${e.currentLessonId}`
                    : `/courses/${e.course._id}`
                }
              >
                {done ? "Review" : "Continue"}
              </Link>
              <button
                className="btn btn-ghost"
                style={{ color: "var(--color-danger)", padding: "4px 8px", marginTop: 2 }}
                onClick={() => leave(e)}
              >
                Leave course
              </button>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
