import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import Layout from "../components/Layout";
import { CenterLoader, CourseThumb } from "../components/Bits";
import { StarsDisplay } from "../components/Stars";
import { useToast } from "../context/ToastContext";
import { fmtDuration } from "../lib/lessonTypes";

const SORTS = [
  ["newest", "Newest"],
  ["title", "Title A–Z"],
  ["rating", "Top rated"],
  ["shortest", "Shortest"],
  ["longest", "Longest"],
];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Catalog() {
  const toast = useToast();
  const [data, setData] = useState(null); // { courses, total, page, pages, categories }
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
    api.get("/enrollments/mine").then((r) => setMineIds(new Set(r.data.enrollments.map((e) => e.course._id)))).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get("/courses", { params: { q, category, difficulty, sort, page, limit: 12 } })
        .then((r) => setData(r.data))
        .catch(() => setData({ courses: [], total: 0, page: 1, pages: 1, categories: [] }));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category, difficulty, sort, page]);

  const enroll = async (id) => {
    setEnrolling(id);
    try {
      await api.post("/enrollments", { courseId: id });
      toast("Enrolled");
      setMineIds((s) => new Set([...s, id]));
    } catch (e) {
      toast(e.message);
    }
    setEnrolling(null);
  };

  return (
    <Layout>
      <div className="row" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Browse Courses</h2>
        {data && (
          <span className="text-muted" style={{ fontSize: 13, marginLeft: 4 }}>
            {data.total} course{data.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="filter-bar">
        <input
          className="input"
          placeholder="Search courses…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {(data?.categories || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Any level</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {cap(d)}
            </option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <CenterLoader />
      ) : data.courses.length === 0 ? (
        <p className="text-muted">No courses match your filters.</p>
      ) : (
        <>
          <div className="grid-3">
            {data.courses.map((c) => {
              const owned = mineIds.has(c._id);
              return (
                <div key={c._id} className="card elev-sm">
                  <Link className="plain clickable" to={`/courses/${c._id}`} style={{ display: "block" }}>
                    <CourseThumb src={c.thumbnailUrl} height={110} />
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
                    <button className="btn btn-secondary btn-block" style={{ justifyContent: "center" }} disabled>
                      Enrolled
                    </button>
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
