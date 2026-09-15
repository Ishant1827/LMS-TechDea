import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Trash2, ArrowUp, ArrowDown, ArrowLeft, Plus, ImagePlus, Eye } from "lucide-react";
import api from "@/shared/api/client";
import Layout from "@/shared/components/layout/Layout";
import Modal from "@/shared/components/ui/Modal";
import CoursePreview from "@/features/teacher/components/CoursePreview";
import { CenterLoader, CourseThumb } from "@/shared/components/ui";
import Select from "@/shared/components/ui/Select";
import { useToast } from "@/shared/context/ToastContext";
import { useConfirm } from "@/shared/context/ConfirmContext";
import { useAuth } from "@/features/auth/AuthContext";
import { LESSON_TYPES, typeMeta, fmtDuration } from "@/shared/lib/lessonTypes";
import { fileToResizedDataUrl } from "@/shared/lib/image";

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
  const { user } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (isNew) return;
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
      .catch(() => {
        toast("Course not found");
        nav("/manage");
      });
  }, [id]);

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
      toast(err.message);
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
    if (!form.title.trim()) return toast("Title is required");
    const hrs = Number(form.hours) || 0;
    if (hrs < 0 || hrs > 500) return toast("Estimated time must be between 0 and 500 hours");
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
      toast(e.message);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <Layout>
        <CenterLoader />
      </Layout>
    );

  const detailsForm = (
    <form onSubmit={saveCourse}>
      <div className="field">
        <label>Thumbnail</label>
        <CourseThumb src={form.thumbnailUrl} height={140} />
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
      <div className="row" style={{ marginBottom: 18 }}>
        <Link className="back" to="/manage">
          <ArrowLeft />
          Courses
        </Link>
        <h2 style={{ margin: 0 }}>{isNew ? "New Course" : "Edit Course"}</h2>
        {!isNew && course && (
          <div className="chip-row" style={{ marginLeft: "auto" }}>
            {lessons.length > 0 && (
              <button className="btn btn-secondary" onClick={() => setPreviewOpen(true)}>
                <Eye />
                Preview as student
              </button>
            )}
            <span className={"tag " + (course.published ? "tag-accent" : "tag-neutral")}>
              {course.published ? "Published" : "Draft"}
            </span>
          </div>
        )}
      </div>

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
          {/* details + status — right on desktop, first on mobile */}
          <div className="col-details">
            <div className="card elev-sm" style={{ marginBottom: 16 }}>
              <div className="card-kicker">Course details</div>
              {detailsForm}
            </div>
            <StatusCard lessons={lessons} course={course} />
          </div>

          {/* curriculum — left / main */}
          <div className="col-curriculum">
            <LessonManager courseId={id} lessons={lessons} setLessons={setLessons} />
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ── status ─────────────────────────────────────────────────────────────── */
function StatusCard({ lessons, course }) {
  const moduleCount = new Set(lessons.map((l) => l.module)).size;
  const byType = { video: 0, reading: 0, file: 0 };
  lessons.forEach((l) => {
    byType[l.type] = (byType[l.type] || 0) + 1;
  });
  const minutes = lessons.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);
  const drafts = lessons.filter((l) => l.published === false).length;

  const Row = ({ label, value }) => (
    <div className="status-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  return (
    <div className="card elev-sm">
      <div className="card-kicker">Status</div>
      <Row label="Modules" value={moduleCount} />
      <Row label="Video lessons" value={byType.video} />
      <Row label="Reading material" value={byType.reading} />
      <Row label="Materials (files)" value={byType.file} />
      {drafts > 0 && <Row label="Drafts (hidden)" value={drafts} />}
      <div className="hr" style={{ margin: "8px 0" }} />
      <Row label="Total length" value={minutes ? fmtDuration(minutes) : "—"} />
      <Row label="Students enrolled" value={course?.enrollmentCount ?? 0} />
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

function groupByModule(lessons) {
  const out = [];
  for (const l of lessons) {
    let g = out.find((x) => x.name === l.module);
    if (!g) {
      g = { name: l.module, items: [] };
      out.push(g);
    }
    g.items.push(l);
  }
  return out;
}

function LessonManager({ courseId, lessons, setLessons }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(blankLesson);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  const reload = () =>
    api.get(`/courses/${courseId}/lessons`).then((r) => setLessons(r.data.lessons));

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const focusForm = (preset) => {
    setEditingId(null);
    setDraft({ ...blankLesson, ...preset });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return toast("Lesson title is required");
    setBusy(true);
    try {
      const body = { ...draft, durationMin: Number(draft.durationMin) || 0 };
      if (editingId) await api.put(`/courses/${courseId}/lessons/${editingId}`, body);
      else await api.post(`/courses/${courseId}/lessons`, body);
      await reload();
      setDraft(blankLesson);
      setEditingId(null);
      toast(editingId ? "Lesson updated" : "Lesson added");
    } catch (e) {
      toast(e.message);
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
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const togglePublished = async (l) => {
    try {
      await api.put(`/courses/${courseId}/lessons/${l._id}`, { published: l.published === false });
      await reload();
    } catch (e) {
      toast(e.message);
    }
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
      if (editingId === l._id) {
        setEditingId(null);
        setDraft(blankLesson);
      }
      toast("Lesson deleted");
    } catch (e) {
      toast(e.message);
    }
  };

  // reorder within one module's items, then persist the whole flat order
  const move = async (moduleName, localIdx, dir) => {
    const groups = groupByModule(lessons);
    const g = groups.find((x) => x.name === moduleName);
    const j = localIdx + dir;
    if (!g || j < 0 || j >= g.items.length) return;
    const reordered = g.items.slice();
    [reordered[localIdx], reordered[j]] = [reordered[j], reordered[localIdx]];

    let k = 0;
    const flat = lessons.map((l) => (l.module === moduleName ? reordered[k++] : l));
    setLessons(flat);
    try {
      await api.put(`/courses/${courseId}/lessons/reorder`, { orderedIds: flat.map((l) => l._id) });
    } catch (e) {
      toast(e.message);
      reload();
    }
  };

  const groups = groupByModule(lessons);
  const total = lessons.length;
  const minutes = lessons.reduce((s, l) => s + (Number(l.durationMin) || 0), 0);

  return (
    <div>
      <div className="row" style={{ marginBottom: 10 }}>
        <h4 className="section-h" style={{ margin: 0 }}>
          Curriculum
        </h4>
        <span className="muted-sm" style={{ marginLeft: "auto" }}>
          {total} item{total === 1 ? "" : "s"}
          {minutes ? ` · ${fmtDuration(minutes)}` : ""}
        </span>
      </div>

      {total === 0 && (
        <p className="muted-sm">
          Nothing here yet. Add your first lesson below — a course needs at least one before it can be
          published. Type a new name in the <strong>Module</strong> field to start a new module.
        </p>
      )}

      {groups.map((g) => (
        <div key={g.name} className="mod-section">
          <div className="mod-head">
            <span>{g.name}</span>
            <span className="count">
              {g.items.length} item{g.items.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginLeft: "auto" }}
              onClick={() => focusForm({ module: g.name })}
            >
              <Plus />
              Add
            </button>
          </div>
          {g.items.map((l, i) => {
            const m = typeMeta(l.type);
            const isDraft = l.published === false;
            return (
              <div key={l._id} className={"lesson-row" + (isDraft ? " is-draft" : "")}>
                <span className="type-chip" style={{ flex: "none" }} title={m.label}>
                  <m.Icon />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {l.title}
                    {isDraft && (
                      <span className="tag tag-neutral" style={{ marginLeft: 6, fontSize: 9 }}>
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="muted-sm">
                    {m.label}
                    {l.durationMin ? ` · ${fmtDuration(l.durationMin)}` : ""}
                    {l.type === "video" && l.fileUrl ? " · has attachment" : ""}
                  </div>
                </div>
                <div className="chip-row" style={{ flex: "none" }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => togglePublished(l)}
                    title={isDraft ? "Make visible to students" : "Hide from students (draft)"}
                  >
                    {isDraft ? "Publish" : "Unpublish"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => move(g.name, i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp />
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => move(g.name, i, 1)}
                    disabled={i === g.items.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown />
                  </button>
                  <button className="btn btn-ghost" onClick={() => edit(l)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ color: "var(--color-danger)" }}
                    onClick={() => del(l)}
                    aria-label="Delete"
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <form ref={formRef} onSubmit={submit} className="card elev-sm" style={{ marginTop: 12 }}>
        <div className="card-kicker">{editingId ? "Edit item" : "Add item"}</div>

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

        <div className="form-grid">
          <div className="field">
            <label>Title</label>
            <input className="input" value={draft.title} onChange={set("title")} />
          </div>
          <div className="field">
            <label>Module</label>
            <input className="input" value={draft.module} onChange={set("module")} />
          </div>
        </div>
        <div className="field">
          <label>Duration (minutes)</label>
          <input
            className="input"
            type="number"
            min="0"
            style={{ maxWidth: 160 }}
            value={draft.durationMin}
            onChange={set("durationMin")}
          />
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
            <div className="field">
              <label>Description (shown under the video — optional)</label>
              <textarea
                className="input"
                style={{ minHeight: 90 }}
                value={draft.content}
                onChange={set("content")}
                placeholder="What this video covers, key points, timestamps…"
              />
            </div>
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
          <div className="field">
            <label>Reading text / post</label>
            <textarea
              className="input"
              style={{ minHeight: 120 }}
              value={draft.content}
              onChange={set("content")}
            />
          </div>
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

        <label className="radio" style={{ marginTop: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
          />
          <span className="dot" />
          Visible to students {draft.published ? "" : "— saved as a draft"}
        </label>

        <div className="chip-row" style={{ marginTop: 10 }}>
          <button className={"btn btn-primary" + (busy ? " is-loading" : "")}>
            {editingId ? "Update item" : "Add item"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setEditingId(null);
                setDraft(blankLesson);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
