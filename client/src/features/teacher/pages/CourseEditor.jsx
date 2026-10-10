import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Plus,
  ImagePlus,
  Eye,
  EyeOff,
  Pencil,
  GripVertical,
  ChevronsUp,
  ChevronsDown,
  FolderPlus,
  ListPlus,
  Rocket,
  Layers,
  PlayCircle,
  FileText,
  Paperclip,
  Clock,
  Users,
  CheckCircle2,
  Circle,
} from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import Modal from "@/shared/components/ui/Modal";
import CoursePreview from "@/features/teacher/components/CoursePreview";
import { CenterLoader, CourseThumb, ErrorState } from "@/shared/components/ui";
import Select from "@/shared/components/ui/Select";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { useAuth } from "@/features/auth/AuthContext";
import { LESSON_TYPES, typeMeta, fmtDuration, groupByModule } from "@/shared/lib/lessonTypes";
import { fileToResizedDataUrl } from "@/shared/lib/image";
import ReadingEditor from "@/features/teacher/components/ReadingEditor";

const emptyForm = {
  title: "",
  teacherName: "",
  description: "",
  hours: 0,
  learn: "",
  prerequisites: "",
  category: "",
  difficulty: "",
  thumbnailUrl: "",
};
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

export default function CourseEditor() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [loadError, setLoadError] = useState(null);

  // The editor hydrates a form rather than a list, so it keeps its own load —
  // but it no longer treats every failure as a deleted course.
  const loadCourse = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    api
      .get(`/courses/${id}`)
      .then((r) => {
        const c = r.data.course;
        setForm({
          title: c.title,
          teacherName: c.teacherName || "",
          description: c.description || "",
          hours: c.hours || 0,
          learn: (c.learn || []).join("\n"),
          prerequisites: (c.prerequisites || []).join("\n"),
          category: c.category || "",
          difficulty: c.difficulty || "",
          thumbnailUrl: c.thumbnailUrl || "",
        });
        setCourse(c);
        setLessons(r.data.lessons);
        setLoading(false);
      })
      .catch((e) => {
        // Only a genuinely missing or forbidden course sends the teacher back
        // to the list; a dropped connection stays put and offers a retry.
        if (e.status === 404 || e.status === 403) {
          toast("Course not found", "error");
          return nav("/manage");
        }
        setLoadError(e);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isNew) loadCourse();
  }, [isNew, loadCourse]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pickThumb = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, { maxW: 800, maxH: 800, quality: 0.72 });
      setForm((f) => ({ ...f, thumbnailUrl: dataUrl }));
      toast("Image added — Save Changes to keep it");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const payload = () => ({
    title: form.title.trim(),
    description: form.description,
    hours: Number(form.hours) || 0,
    thumbnailUrl: form.thumbnailUrl,
    category: form.category.trim(),
    difficulty: form.difficulty,
    learn: form.learn.split("\n").map((s) => s.trim()).filter(Boolean),
    prerequisites: form.prerequisites.split("\n").map((s) => s.trim()).filter(Boolean),
  });

  const saveCourse = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast("Title is required", "error");
    const hrs = Number(form.hours) || 0;
    if (hrs < 0 || hrs > 500) return toast("Estimated time must be between 0 and 500 hours", "error");
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await api.post("/courses", payload());
        toast("Course created — now add lessons");
        nav(`/manage/courses/${data.course._id}`, { replace: true });
      } else {
        const { data } = await api.put(`/courses/${id}`, payload());
        setCourse((c) => ({ ...c, ...data.course }));
        toast("Saved");
      }
    } catch (e) {
      toast(e.message, "error");
    }
    setSaving(false);
  };

  // The one place a course goes live or back to draft. Lessons only have a
  // visibility switch inside their own form.
  const togglePublish = async () => {
    const enrolled = course.enrollmentCount || 0;
    if (course.published && enrolled > 0) {
      const ok = await confirm({
        title: "Unpublish this course?",
        message: `${enrolled} enrolled student${enrolled === 1 ? "" : "s"} will lose access until you publish it again.`,
        detail: "Their progress is kept.",
        confirmLabel: "Unpublish",
        danger: true,
      });
      if (!ok) return;
    }
    setPublishing(true);
    try {
      const { data } = await api.patch(`/courses/${id}/publish`, { published: !course.published });
      setCourse((c) => ({ ...c, published: data.course.published }));
      toast(data.course.published ? "Course published — students can enrol" : "Moved back to draft");
    } catch (e) {
      toast(e.message, "error");
    }
    setPublishing(false);
  };

  if (loadError)
    return (
      <Layout>
        <ErrorState
          title="Couldn't load this course"
          message={loadError.message}
          onRetry={loadCourse}
        />
      </Layout>
    );

  if (loading)
    return (
      <Layout>
        <CenterLoader variant="editor" />
      </Layout>
    );

  const visibleCount = lessons.filter((l) => l.published !== false).length;

  const detailsForm = (
    <form onSubmit={saveCourse}>
      <div className="field">
        <label>Thumbnail</label>
        <CourseThumb src={form.thumbnailUrl} style={{ maxWidth: 360 }} />
        <div className="chip-row" style={{ marginTop: 8 }}>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            <ImagePlus />
            {form.thumbnailUrl ? "Replace image" : "Upload image"}
            <input type="file" accept="image/*" hidden onChange={pickThumb} />
          </label>
          {form.thumbnailUrl && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: "var(--color-danger)" }}
              onClick={() => setForm((f) => ({ ...f, thumbnailUrl: "" }))}
            >
              Remove
            </button>
          )}
        </div>
        <div className="muted-sm" style={{ marginTop: 4 }}>
          JPG or PNG. It's resized automatically and saved with the course.
        </div>
      </div>
      <div className="field">
        <label>Title</label>
        <input className="input" value={form.title} onChange={set("title")} />
      </div>
      <div className="field">
        <label>Teacher shown to students</label>
        <input className="input" value={form.teacherName || user.name} disabled />
        <div className="muted-sm" style={{ marginTop: 4 }}>
          Your account name. Change it in <Link to="/profile">Profile</Link> and it updates on all
          your courses.
        </div>
      </div>
      <div className="field">
        <label>Description</label>
        <textarea className="input" value={form.description} onChange={set("description")} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label>Category</label>
          <input
            className="input"
            value={form.category}
            onChange={set("category")}
            placeholder="e.g. Design, Business"
          />
        </div>
        <div className="field">
          <label>Difficulty</label>
          <Select
            aria-label="Difficulty"
            value={form.difficulty}
            onChange={(v) => setForm((f) => ({ ...f, difficulty: v }))}
            options={[
              { value: "", label: "Not set" },
              ...DIFFICULTIES.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) })),
            ]}
          />
        </div>
      </div>
      <div className="field">
        <label>Estimated time (hours)</label>
        <input
          className="input"
          type="number"
          min="0"
          max="500"
          step="1"
          style={{ maxWidth: 140 }}
          value={form.hours}
          onChange={set("hours")}
        />
        <div className="muted-sm" style={{ marginTop: 4 }}>
          Only shown until the course has lessons — after that students see the real total.
        </div>
      </div>
      <div className="field">
        <label>What you'll learn (one per line)</label>
        <textarea className="input" style={{ minHeight: 90 }} value={form.learn} onChange={set("learn")} />
      </div>
      <div className="field" style={{ marginBottom: 16 }}>
        <label>Prerequisites (one per line)</label>
        <textarea
          className="input"
          style={{ minHeight: 70 }}
          value={form.prerequisites}
          onChange={set("prerequisites")}
          placeholder="e.g. Basic HTML"
        />
      </div>
      <button className={"btn btn-primary" + (saving ? " is-loading" : "")}>
        {isNew ? "Create Course" : "Save Changes"}
      </button>
    </form>
  );

  return (
    <Layout>
      <Link className="page-back" to="/manage">
        <ArrowLeft />
        Back to courses
      </Link>
      <div className="editor-head">
        <div className="editor-head-text">
          {!isNew && course && (
            <span className={"tag " + (course.published ? "tag-accent" : "tag-neutral")}>
              {course.published ? "Published" : "Draft"}
            </span>
          )}
          <h2>{isNew ? "New course" : course?.title || "Edit course"}</h2>
          {!isNew && course && (
            <p className="editor-head-sub">
              {course.published
                ? "Live in the catalog. Changes you save show up for students straight away."
                : visibleCount
                ? "Only you can see this course until you publish it."
                : "Add at least one visible lesson, then publish."}
            </p>
          )}
        </div>
        {!isNew && course && (
          <div className="editor-head-actions">
            {lessons.length > 0 && (
              <button className="btn btn-secondary" onClick={() => setPreviewOpen(true)}>
                <Eye />
                Preview
              </button>
            )}
            <button
              className={
                "btn " + (course.published ? "btn-secondary" : "btn-primary") + (publishing ? " is-loading" : "")
              }
              onClick={togglePublish}
              disabled={!course.published && !visibleCount}
              title={!course.published && !visibleCount ? "Add a visible lesson first" : undefined}
            >
              {course.published ? <EyeOff /> : <Rocket />}
              {course.published ? "Unpublish" : "Publish course"}
            </button>
          </div>
        )}
      </div>

      {!isNew && course && <StatusBar lessons={lessons} course={course} />}

      {previewOpen && (
        <Modal title="Preview as student" wide onClose={() => setPreviewOpen(false)}>
          <CoursePreview lessons={lessons} />
        </Modal>
      )}

      {isNew ? (
        <div style={{ maxWidth: 560 }}>
          <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
            Create the course, then you'll build its curriculum.
          </p>
          {detailsForm}
        </div>
      ) : (
        <div className="editor-split">
          {/* step 1, details + status — left column on desktop, top on one column */}
          <div className="col-details">
            <div className="card elev-sm" style={{ marginBottom: 16 }}>
              <div className="step-label">
                <span className="step-num">1</span>
                Course details
              </div>
              {detailsForm}
            </div>
          </div>

          {/* step 2, curriculum — right / wider column */}
          <div className="col-curriculum">
            <LessonManager courseId={id} lessons={lessons} setLessons={setLessons} />
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ── status ─────────────────────────────────────────────────────────────── */
// One strip under the header: what the course holds, and — while it's still a
// draft — what's left before it's worth publishing. Only a visible lesson is
// required (the server refuses without one); the rest are what students see
// first in the catalog, so they're flagged rather than enforced.
function StatusBar({ lessons, course }) {
  const visible = lessons.filter((l) => l.published !== false);
  const hidden = lessons.length - visible.length;
  const moduleCount = new Set(lessons.map((l) => l.module)).size;
  const byType = { video: 0, reading: 0, file: 0 };
  lessons.forEach((l) => {
    byType[l.type] = (byType[l.type] || 0) + 1;
  });
  const minutes = lessons.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);

  const stats = [
    [Layers, moduleCount, moduleCount === 1 ? "Module" : "Modules"],
    [PlayCircle, byType.video, byType.video === 1 ? "Video" : "Videos"],
    [FileText, byType.reading, byType.reading === 1 ? "Reading" : "Readings"],
    [Paperclip, byType.file, byType.file === 1 ? "File" : "Files"],
    [Clock, minutes ? fmtDuration(minutes) : "—", "Total length"],
    [Users, course.enrollmentCount ?? 0, course.enrollmentCount === 1 ? "Student" : "Students"],
  ];
  if (hidden) stats.push([EyeOff, hidden, "Hidden"]);

  const checks = [
    [visible.length > 0, "At least one visible lesson", true],
    [!!course.thumbnailUrl, "Cover image"],
    [!!course.description?.trim(), "Description"],
  ];
  const left = checks.filter(([ok]) => !ok).length;

  return (
    <div className="card elev-sm status-bar">
      <div className="sb-stats">
        {stats.map(([Icon, value, label]) => (
          <div key={label} className="sb-stat">
            <Icon aria-hidden="true" />
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {!course.published && (
        <div className="sb-checks">
          <span className="sb-checks-h">
            {left ? `Before you publish · ${left} to go` : "Ready to publish"}
          </span>
          <ul>
            {checks.map(([ok, label, required]) => (
              <li key={label} className={ok ? "is-done" : required ? "is-required" : ""}>
                {ok ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
                {label}
                {!ok && <small>{required ? "required" : "recommended"}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── curriculum ─────────────────────────────────────────────────────────── */
const blankLesson = {
  title: "",
  module: "Introduction",
  type: "reading",
  durationMin: 0,
  published: true,
  videoUrl: "",
  content: "",
  fileUrl: "",
  fileName: "",
};

// Put lesson `dragId` into `module`, just before `beforeId` — or at the end of
// that module when beforeId is null. Returns the new flat order, plus the
// moved lesson when its module changed (that needs saving on its own).
function placeLesson(flat, dragId, module, beforeId) {
  const dragged = flat.find((l) => l._id === dragId);
  if (!dragged) return { next: flat, changed: null };
  const rest = flat.filter((l) => l._id !== dragId);
  const moved = { ...dragged, module };
  let at;
  if (beforeId) at = rest.findIndex((l) => l._id === beforeId);
  else {
    at = -1;
    rest.forEach((l, i) => {
      if (l.module === module) at = i;
    });
    at = at === -1 ? rest.length : at + 1;
  }
  rest.splice(at, 0, moved);
  return { next: rest, changed: dragged.module !== module ? moved : null };
}

function LessonManager({ courseId, lessons, setLessons }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(blankLesson);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // drag and drop (desktop): what's being dragged, and where it would land
  const [dragId, setDragId] = useState(null);
  const [drop, setDrop] = useState(null); // { module, beforeId } | null
  const [renaming, setRenaming] = useState(null); // { from, to }

  const reload = () =>
    api.get(`/courses/${courseId}/lessons`).then((r) => setLessons(r.data.lessons));

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const groups = groupByModule(lessons);
  const total = lessons.length;
  const minutes = lessons.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);

  const openAdd = (preset) => {
    setEditingId(null);
    setDraft({ ...blankLesson, module: groups[groups.length - 1]?.name || "Introduction", ...preset });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(blankLesson);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return toast("Lesson title is required", "error");
    setBusy(true);
    try {
      const body = { ...draft, durationMin: Number(draft.durationMin) || 0 };
      if (editingId) await api.put(`/courses/${courseId}/lessons/${editingId}`, body);
      else await api.post(`/courses/${courseId}/lessons`, body);
      await reload();
      toast(editingId ? "Lesson updated" : "Lesson added");
      closeForm();
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };

  const edit = (l) => {
    setEditingId(l._id);
    setDraft({
      title: l.title,
      module: l.module,
      type: l.type || "reading",
      durationMin: l.durationMin || 0,
      published: l.published !== false,
      videoUrl: l.videoUrl || "",
      content: l.content || "",
      fileUrl: l.fileUrl || "",
      fileName: l.fileName || "",
    });
    setFormOpen(true);
  };

  const del = async (l) => {
    const ok = await confirm({
      title: "Delete this lesson?",
      message: `"${l.title}" will be permanently deleted.`,
      detail:
        "Students who already completed it will see their progress for this course recalculated.",
      confirmLabel: "Delete lesson",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/courses/${courseId}/lessons/${l._id}`);
      await reload();
      toast("Lesson deleted");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  // Show the new order at once, then save it. A lesson that changed module
  // is saved first, so a failure can't leave it ordered into the wrong one.
  const persist = async (next, changed) => {
    setLessons(next);
    try {
      if (changed) await api.put(`/courses/${courseId}/lessons/${changed._id}`, { module: changed.module });
      await api.put(`/courses/${courseId}/lessons/reorder`, { orderedIds: next.map((l) => l._id) });
    } catch (e) {
      toast(e.message, "error");
      reload();
    }
  };

  // ↑ / ↓ — within a module, and across the edge into the neighbouring one,
  // so every position is reachable without dragging (phones, keyboards).
  const move = (gi, li, dir) => {
    const g = groups[gi];
    const l = g.items[li];
    const j = li + dir;
    if (j >= 0 && j < g.items.length) {
      const before = dir < 0 ? g.items[j]._id : g.items[j + 1]?._id || null;
      const { next } = placeLesson(lessons, l._id, g.name, before);
      return persist(next, null);
    }
    const ng = groups[gi + dir];
    if (!ng) return;
    // up from the top → bottom of the module above; down from the bottom → top of the one below
    const before = dir < 0 ? null : ng.items[0]._id;
    const { next, changed } = placeLesson(lessons, l._id, ng.name, before);
    persist(next, changed);
  };

  const moveModule = (gi, dir) => {
    const order = groups.slice();
    const j = gi + dir;
    if (j < 0 || j >= order.length) return;
    [order[gi], order[j]] = [order[j], order[gi]];
    persist(order.flatMap((g) => g.items), null);
  };

  const saveRename = async () => {
    const { from, to } = renaming;
    const name = to.trim();
    setRenaming(null);
    if (!name || name === from) return;
    if (groups.some((g) => g.name === name))
      return toast(`There's already a module called "${name}"`, "error");
    const items = lessons.filter((l) => l.module === from);
    setLessons(lessons.map((l) => (l.module === from ? { ...l, module: name } : l)));
    try {
      await Promise.all(
        items.map((l) => api.put(`/courses/${courseId}/lessons/${l._id}`, { module: name }))
      );
      toast("Module renamed");
    } catch (e) {
      toast(e.message, "error");
      reload();
    }
  };

  // drag handlers — the row under the pointer decides before/after by its midpoint
  const onRowDragOver = (e, module, l, nextId) => {
    if (!dragId) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const before = e.clientY < r.top + r.height / 2 ? l._id : nextId;
    if (drop?.module !== module || drop?.beforeId !== before) setDrop({ module, beforeId: before });
  };
  const onModuleDragOver = (e, module) => {
    if (!dragId) return;
    e.preventDefault();
    if (drop?.module !== module || drop?.beforeId !== null) setDrop({ module, beforeId: null });
  };
  const onDrop = (e) => {
    e.preventDefault();
    if (dragId && drop && drop.beforeId !== dragId) {
      const { next, changed } = placeLesson(lessons, dragId, drop.module, drop.beforeId);
      const same = next.every((l, i) => l._id === lessons[i]._id) && !changed;
      if (!same) persist(next, changed);
    }
    setDragId(null);
    setDrop(null);
  };
  const endDrag = () => {
    setDragId(null);
    setDrop(null);
  };

  const first = (gi, li) => gi === 0 && li === 0;
  const last = (gi, li) => gi === groups.length - 1 && li === groups[gi].items.length - 1;

  return (
    <div>
      <div className="lm-head">
        <h4 className="step-label">
          <span className="step-num">2</span>
          Curriculum
        </h4>
        <span className="muted-sm">
          {total} lesson{total === 1 ? "" : "s"}
          {groups.length > 1 ? ` · ${groups.length} modules` : ""}
          {minutes ? ` · ${fmtDuration(minutes)}` : ""}
        </span>
        <button type="button" className="btn btn-primary lm-add" onClick={() => openAdd()}>
          <Plus />
          Add lesson
        </button>
      </div>

      {total === 0 ? (
        <div className="card elev-sm quiet-note lm-empty">
          <ListPlus />
          <div>
            <b>No lessons yet</b>
            <span>
              Add your first video, reading or file. A course needs at least one visible lesson
              before it can be published.
            </span>
          </div>
        </div>
      ) : (
        total > 1 && (
          <p className="lm-hint">
            <GripVertical aria-hidden="true" />
            Drag lessons to reorder them or move them between modules — or use the arrows.
          </p>
        )
      )}

      {groups.map((g, gi) => (
        <section
          key={g.name}
          className={"mod-section lm-module" + (drop?.module === g.name && drop.beforeId === null ? " is-drop-end" : "")}
          onDragOver={(e) => onModuleDragOver(e, g.name)}
          onDrop={onDrop}
        >
          <div className="mod-head lm-mod-head">
            <span className="lm-mod-num">{gi + 1}</span>
            {renaming?.from === g.name ? (
              <input
                className="input lm-rename"
                value={renaming.to}
                autoFocus
                aria-label="Module name"
                onChange={(e) => setRenaming({ ...renaming, to: e.target.value })}
                onBlur={saveRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(null);
                }}
              />
            ) : (
              <button
                type="button"
                className="lm-mod-name"
                onClick={() => setRenaming({ from: g.name, to: g.name })}
                title="Rename module"
                aria-label={`Rename module ${g.name}`}
              >
                {g.name}
                <Pencil aria-hidden="true" />
              </button>
            )}
            <span className="count">
              {g.items.length} lesson{g.items.length === 1 ? "" : "s"}
            </span>
            <span className="lm-mod-tools">
              {groups.length > 1 && (
                <>
                  <button
                    type="button"
                    className="lm-icon"
                    onClick={() => moveModule(gi, -1)}
                    disabled={gi === 0}
                    aria-label={`Move module ${g.name} up`}
                    title="Move module up"
                  >
                    <ChevronsUp />
                  </button>
                  <button
                    type="button"
                    className="lm-icon"
                    onClick={() => moveModule(gi, 1)}
                    disabled={gi === groups.length - 1}
                    aria-label={`Move module ${g.name} down`}
                    title="Move module down"
                  >
                    <ChevronsDown />
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-ghost lm-mod-add"
                onClick={() => openAdd({ module: g.name })}
              >
                <Plus />
                Add
              </button>
            </span>
          </div>

          <div className="lm-list">
            {g.items.map((l, li) => {
              const m = typeMeta(l.type);
              const hidden = l.published === false;
              const nextId = g.items[li + 1]?._id || null;
              const dropHere = drop?.module === g.name && drop.beforeId === l._id && dragId !== l._id;
              return (
                <div
                  key={l._id}
                  className={
                    "lesson-row lm-row" +
                    (hidden ? " is-draft" : "") +
                    (dragId === l._id ? " is-dragging" : "") +
                    (dropHere ? " is-drop-before" : "")
                  }
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", l._id);
                    setDragId(l._id);
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(e) => onRowDragOver(e, g.name, l, nextId)}
                  onDrop={onDrop}
                >
                  <span className="lm-grip" aria-hidden="true">
                    <GripVertical />
                  </span>
                  <span className="type-chip" style={{ flex: "none" }} title={m.label}>
                    <m.Icon />
                  </span>
                  <button type="button" className="lm-main" onClick={() => edit(l)}>
                    <span className="lm-title">
                      {l.title}
                      {hidden && (
                        <span className="tag tag-neutral lm-hidden">
                          <EyeOff /> Hidden
                        </span>
                      )}
                    </span>
                    <span className="muted-sm">
                      {m.label}
                      {l.durationMin ? ` · ${fmtDuration(l.durationMin)}` : ""}
                      {l.type === "video" && l.fileUrl ? " · has attachment" : ""}
                    </span>
                  </button>
                  <span className="lm-actions">
                    <button
                      type="button"
                      className="lm-icon"
                      onClick={() => move(gi, li, -1)}
                      disabled={first(gi, li)}
                      aria-label="Move up"
                      title={li === 0 ? "Move to the module above" : "Move up"}
                    >
                      <ArrowUp />
                    </button>
                    <button
                      type="button"
                      className="lm-icon"
                      onClick={() => move(gi, li, 1)}
                      disabled={last(gi, li)}
                      aria-label="Move down"
                      title={li === g.items.length - 1 ? "Move to the module below" : "Move down"}
                    >
                      <ArrowDown />
                    </button>
                    <button
                      type="button"
                      className="lm-icon"
                      onClick={() => edit(l)}
                      aria-label={`Edit ${l.title}`}
                      title="Edit"
                    >
                      <Pencil />
                    </button>
                    <button
                      type="button"
                      className="lm-icon is-danger"
                      onClick={() => del(l)}
                      aria-label={`Delete ${l.title}`}
                      title="Delete"
                    >
                      <Trash2 />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {total > 0 && (
        <button type="button" className="lm-new-module" onClick={() => openAdd({ module: "" })}>
          <FolderPlus />
          New module
        </button>
      )}

      {formOpen && (
        <Modal title={editingId ? "Edit lesson" : "Add lesson"} onClose={closeForm}>
          <form onSubmit={submit} className="lm-form">
            <div className="field">
              <label>Type</label>
              <div className="seg">
                {LESSON_TYPES.map((t) => (
                  <label className="seg-opt" key={t.value}>
                    <input
                      type="radio"
                      name="lesson-type"
                      value={t.value}
                      checked={draft.type === t.value}
                      onChange={() => setDraft({ ...draft, type: t.value })}
                    />
                    <t.Icon style={{ width: 13, height: 13 }} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Title</label>
              <input className="input" value={draft.title} onChange={set("title")} autoFocus />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Module</label>
                <input
                  className="input"
                  list="lm-modules"
                  value={draft.module}
                  onChange={set("module")}
                  placeholder="Pick one, or type a new name"
                />
                <datalist id="lm-modules">
                  {groups.map((g) => (
                    <option key={g.name} value={g.name} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label>Duration (minutes)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={draft.durationMin}
                  onChange={set("durationMin")}
                />
              </div>
            </div>

            {draft.type === "video" && (
              <>
                <div className="field">
                  <label>Video URL (YouTube / Vimeo — embedded, not uploaded)</label>
                  <input
                    className="input"
                    value={draft.videoUrl}
                    onChange={set("videoUrl")}
                    placeholder="https://youtube.com/watch?v=…"
                  />
                </div>
                <ReadingEditor
                  label="Description (shown under the video — optional)"
                  placeholder="What this video covers, key points, timestamps…"
                  minHeight={110}
                  value={draft.content}
                  onChange={set("content")}
                />
                <div className="form-grid">
                  <div className="field">
                    <label>Attachment file URL (optional)</label>
                    <input
                      className="input"
                      value={draft.fileUrl}
                      onChange={set("fileUrl")}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="field">
                    <label>File name shown to students</label>
                    <input
                      className="input"
                      value={draft.fileName}
                      onChange={set("fileName")}
                      placeholder="Slides.pdf"
                    />
                  </div>
                </div>
              </>
            )}
            {draft.type === "reading" && (
              <ReadingEditor value={draft.content} onChange={set("content")} />
            )}
            {draft.type === "file" && (
              <>
                <div className="form-grid">
                  <div className="field">
                    <label>File URL</label>
                    <input className="input" value={draft.fileUrl} onChange={set("fileUrl")} placeholder="https://…" />
                  </div>
                  <div className="field">
                    <label>File name shown to students</label>
                    <input
                      className="input"
                      value={draft.fileName}
                      onChange={set("fileName")}
                      placeholder="Worksheet.pdf"
                    />
                  </div>
                </div>
                <div className="muted-sm" style={{ marginTop: -4 }}>
                  A direct link, or a Google Drive / Dropbox share link (set sharing to “Anyone with the
                  link”). PDFs and images preview inside the lesson; Word &amp; PowerPoint use the Office
                  viewer; other types show a download button.
                </div>
              </>
            )}

            {/* Per-lesson visibility, not a second publish button: the course
                itself is published from the page header. */}
            <label className="radio lm-visible">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
              />
              <span className="dot" />
              <span>
                Show this lesson to students
                <small>{draft.published ? "Visible once the course is published" : "Hidden — only you can see it"}</small>
              </span>
            </label>

            <div className="lm-form-actions">
              <button type="button" className="btn btn-secondary" onClick={closeForm}>
                Cancel
              </button>
              <button className={"btn btn-primary" + (busy ? " is-loading" : "")}>
                {editingId ? "Save lesson" : "Add lesson"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
