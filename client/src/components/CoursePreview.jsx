import { useState } from "react";
import LessonContent from "./LessonContent";
import { typeMeta, fmtDuration } from "../lib/lessonTypes";

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

// Read-only "view the course as a student" — a lesson list + the selected
// lesson's body. Rendered inside a <Modal>.
export default function CoursePreview({ lessons }) {
  const [selId, setSelId] = useState(lessons[0]?._id);
  if (!lessons.length) return <p className="muted-sm">No lessons to preview yet.</p>;

  const cur = lessons.find((l) => l._id === selId) || lessons[0];
  const groups = groupByModule(lessons);

  return (
    <div className="course-preview">
      <aside className="course-preview-nav">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="mod-label">{g.name}</div>
            {g.items.map((l) => {
              const m = typeMeta(l.type);
              return (
                <button
                  key={l._id}
                  className={"cp-lesson" + (l._id === cur._id ? " on" : "")}
                  onClick={() => setSelId(l._id)}
                >
                  <m.Icon />
                  <span className="cp-lesson-t">
                    <span>
                      {l.title}
                      {l.published === false ? " · draft" : ""}
                    </span>
                    <span className="lesson-dur">
                      {m.label}
                      {l.durationMin ? ` · ${fmtDuration(l.durationMin)}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className="course-preview-body lesson-preview">
        <h4 style={{ margin: "0 0 10px" }}>{cur.title}</h4>
        <LessonContent lesson={cur} />
      </div>
    </div>
  );
}
