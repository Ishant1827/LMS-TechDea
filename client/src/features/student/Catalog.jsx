import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import { CenterLoader, CourseThumb, ErrorState, EmptyState } from "@/shared/components/ui";
import { useLoad } from "@/shared/hooks/useLoad";
import Select from "@/shared/components/ui/Select";
import { StarsDisplay } from "@/shared/components/ui/Stars";
import { useToast } from "@/shared/context/ToastContext";
import { fmtDuration } from "@/shared/lib/lessonTypes";
import { cap } from "@/shared/lib/format";

const SORTS = [
  ["newest", "Newest"],
  ["title", "Title A–Z"],
  ["rating", "Top rated"],
  ["shortest", "Shortest"],
  ["longest", "Longest"],
];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

export default function Catalog() {
  const toast = useToast();
  const [mineIds, setMineIds] = useState(new Set());
  const [enrolling, setEnrolling] = useState(null);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);

  // reset to page 1 whenever a filter changes
  useEffect(() => setPage(1), [q, category, difficulty, sort]);

  useEffect(() => {
    // Deliberately silent: this only decides whether a card reads "Enrolled"
    // or offers the button. If it fails the button still works, and enrolling
    // twice is refused by the server with a message — no need to break the
    // catalog over it.
    api
      .get("/enrollments/mine")
      .then((r) => setMineIds(new Set(r.data.enrollments.map((e) => e.course._id))))
      .catch(() => {});
  }, []);

  // Debounced separately from the load; useLoad handles the stale-response
  // race that the old inline `cancelled` flag was guarding against.
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  // { courses, total, page, pages, categories }
  const { status, data, error, reload } = useLoad(
    () =>
      api
        .get("/courses", { params: { q: query, category, difficulty, sort, page, limit: 12 } })
        .then((r) => r.data),
    [query, category, difficulty, sort, page],
    { key: `catalog:${query}|${category}|${difficulty}|${sort}|${page}` }
  );

  const enroll = async (id) => {
    setEnrolling(id);
    try {
      await api.post("/enrollments", { courseId: id });
      toast("Enrolled");
      setMineIds((s) => new Set([...s, id]));
    } catch (e) {
      toast(e.message, "error");
    }
    setEnrolling(null);
  };

  return (
    <Layout>
      <div className="page-head">
        <h2>Browse Courses</h2>
        {data && (
          <span className="page-count">
            {data.total} course{data.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="filter-bar">
        <label className="search-field">
          <Search aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Search courses…"
            aria-label="Search courses"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="filter-selects">
          <Select
            aria-label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "All categories" },
              ...(data?.categories || []).map((c) => ({ value: c, label: c })),
            ]}
          />
          <Select
            aria-label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: "", label: "Any level" },
              ...DIFFICULTIES.map((d) => ({ value: d, label: cap(d) })),
            ]}
          />
          <Select
            aria-label="Sort by"
            value={sort}
            onChange={setSort}
            options={SORTS.map(([v, label]) => ({ value: v, label }))}
          />
        </div>
      </div>

      {status === "error" ? (
        <ErrorState title="Couldn't load the catalog" message={error.message} onRetry={reload} />
      ) : !data ? (
        <CenterLoader variant="cards" />
      ) : data.courses.length === 0 ? (
        <EmptyState title="No courses match" text="Try a different search, or clear the filters." />
      ) : (
        <>
          <div className="course-grid">
            {data.courses.map((c) => {
              const owned = mineIds.has(c._id);
              return (
                <div key={c._id} className="card elev-sm course-card">
                  <Link className="plain clickable" to={`/courses/${c._id}`} style={{ display: "block" }}>
                    <CourseThumb src={c.thumbnailUrl} />
                  </Link>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="tag tag-neutral" style={{ width: "fit-content" }}>
                      Free
                    </span>
                    {c.difficulty && (
                      <span className="tag tag-outline" style={{ width: "fit-content" }}>
                        {cap(c.difficulty)}
                      </span>
                    )}
                    {c.category && (
                      <span className="muted-sm" style={{ marginLeft: "auto" }}>
                        {c.category}
                      </span>
                    )}
                  </div>
                  <Link className="card-title plain clickable" to={`/courses/${c._id}`}>
                    {c.title}
                  </Link>
                  <div className="card-meta">
                    {c.teacherName || "—"} · {c.lessonCount} lessons
                    {c.minutes ? ` · ${fmtDuration(c.minutes)}` : ""}
                  </div>
                  {c.reviewCount > 0 && (
                    <div className="card-meta">
                      <StarsDisplay value={c.rating} />
                      <span>
                        {c.rating.toFixed(1)} ({c.reviewCount})
                      </span>
                    </div>
                  )}
                  {owned ? (
                    <Link className="btn btn-secondary btn-block" to={`/courses/${c._id}`}>
                      Enrolled · Open
                      <ArrowRight />
                    </Link>
                  ) : (
                    <button
                      className={"btn btn-primary btn-block" + (enrolling === c._id ? " is-loading" : "")}
                      style={{ justifyContent: "center" }}
                      onClick={() => enroll(c._id)}
                    >
                      Enroll Free
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {data.pages > 1 && (
            <div className="pager">
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="muted-sm">
                Page {data.page} of {data.pages}
              </span>
              <button
                className="btn btn-secondary"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
