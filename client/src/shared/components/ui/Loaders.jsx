import { useEffect, useState } from "react";
import Brand from "@/shared/components/layout/Brand";

// Most loads finish quickly; showing a placeholder for 100ms and then
// swapping it out reads as a flicker. Wait this long before showing anything.
const SHOW_AFTER_MS = 300;

function useShowAfter(ms = SHOW_AFTER_MS) {
  const [show, setShow] = useState(ms === 0);
  useEffect(() => {
    if (ms === 0) return;
    const t = setTimeout(() => setShow(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return show;
}

// Full-screen splash — now only for the rare boot with no remembered session
// to draw the app frame from. It carries the brand rather than a bare spinner.
export function BootLoader({ label = "Loading…" }) {
  const show = useShowAfter();
  if (!show) return <div className="loader-screen loader-screen--boot" aria-busy="true" />;
  return (
    <div className="loader-screen loader-screen--boot">
      <span className="brand">
        <Brand size={44} />
      </span>
      <div className="loader-block">
        <span className="spinner" /> <span>{label}</span>
      </div>
    </div>
  );
}

/* ── skeleton pieces ────────────────────────────────────────────────────── */
const Line = ({ w = "100%", h = 12, style }) => (
  <span className="skeleton sk-line" style={{ display: "block", width: w, height: h, ...style }} />
);
const Box = ({ h = 80, r, style }) => (
  <span className="skeleton sk-card" style={{ display: "block", height: h, borderRadius: r, ...style }} />
);

const Head = ({ action = false }) => (
  <div className="sk-head">
    <div style={{ flex: 1 }}>
      <Line w="38%" h={26} />
      <Line w="24%" h={11} style={{ marginTop: 10 }} />
    </div>
    {action && <Box h={42} r={12} style={{ width: 140, flex: "none" }} />}
  </div>
);

const CourseCard = () => (
  <div className="card sk-tile">
    <Box h={0} r={12} style={{ aspectRatio: "16 / 9", height: "auto" }} />
    <Line w="30%" h={18} style={{ borderRadius: 999 }} />
    <Line w="75%" h={15} />
    <Line w="50%" h={11} />
    <Box h={42} r={12} style={{ marginTop: 4 }} />
  </div>
);

const Rows = ({ n = 5 }) => (
  <div className="card sk-rows">
    {Array.from({ length: n }, (_, i) => (
      <div className="sk-row" key={i}>
        <span className="skeleton" style={{ width: 34, height: 34, borderRadius: 10, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Line w={`${70 - (i % 3) * 12}%`} h={13} />
          <Line w="35%" h={10} style={{ marginTop: 8 }} />
        </div>
        <Line w={64} h={26} style={{ borderRadius: 999, flex: "none" }} />
      </div>
    ))}
  </div>
);

const Stats = ({ n = 4 }) => (
  <div className="stat-strip" style={n === 3 ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } : undefined}>
    {Array.from({ length: n }, (_, i) => (
      <div className="card sk-tile" key={i}>
        <span className="skeleton" style={{ width: 34, height: 34, borderRadius: 10 }} />
        <Line w="40%" h={22} />
        <Line w="60%" h={10} />
      </div>
    ))}
  </div>
);

const VARIANTS = {
  // student / teacher dashboards: greeting, hero card, numbers, two lists
  dashboard: () => (
    <>
      <Head />
      <div className="card sk-hero">
        <Box h={0} r={12} style={{ aspectRatio: "16 / 9", height: "auto", width: 150, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Line w="22%" h={10} />
          <Line w="55%" h={18} style={{ marginTop: 8 }} />
          <Line w="70%" h={11} style={{ marginTop: 10 }} />
          <Line w="100%" h={8} style={{ marginTop: 14, maxWidth: 320 }} />
        </div>
      </div>
      <Stats />
      <div className="dash-grid">
        <Rows n={3} />
        <Rows n={3} />
      </div>
    </>
  ),
  // catalog / my learning: a grid of course cards
  grid: () => (
    <>
      <Head />
      <Cards />
    </>
  ),
  cards: () => <Cards />,
  // course page: cover, title, modules, side box
  detail: () => (
    <div className="split">
      <div>
        <Line w={120} h={12} style={{ marginBottom: 14 }} />
        <Box h={0} r={14} style={{ aspectRatio: "16 / 9", height: "auto", marginBottom: 14 }} />
        <Line w="60%" h={26} />
        <Line w="40%" h={11} style={{ marginTop: 10, marginBottom: 18 }} />
        <Rows n={3} />
      </div>
      <div className="card sk-tile">
        <Line w="30%" h={26} />
        <Box h={44} r={12} />
        <Line w="70%" h={11} />
        <Line w="50%" h={11} />
      </div>
    </div>
  ),
  // course editor: header, status strip, details + curriculum
  editor: () => (
    <>
      <Head action />
      <Box h={46} r={18} style={{ marginBottom: 22 }} />
      <div className="editor-split">
        <div className="card sk-tile">
          <Line w="45%" h={16} />
          <Box h={0} r={12} style={{ aspectRatio: "16 / 9", height: "auto" }} />
          <Box h={42} r={10} />
          <Box h={42} r={10} />
          <Box h={90} r={10} />
        </div>
        <div>
          <Line w="35%" h={18} style={{ marginBottom: 14 }} />
          <Rows n={4} />
        </div>
      </div>
    </>
  ),
  // a page that is mostly one list or table
  list: () => (
    <>
      <Head action />
      <div className="sk-toolbar">
        <Box h={42} r={10} style={{ flex: "2 1 200px" }} />
        <Box h={42} r={10} style={{ flex: "1 1 120px" }} />
      </div>
      <Rows n={6} />
    </>
  ),
  // a list inside a page whose header is already on screen
  rows: () => <Rows n={4} />,
};

function Cards() {
  return (
    <div className="course-grid">
      {Array.from({ length: 6 }, (_, i) => (
        <CourseCard key={i} />
      ))}
    </div>
  );
}

// In-page placeholder in the shape of what's coming. Named CenterLoader for
// history — it used to be a centred spinner — so call sites only pick a shape.
export function CenterLoader({ variant = "list", label = "Loading…" }) {
  const show = useShowAfter();
  const Shape = VARIANTS[variant] || VARIANTS.list;
  return (
    <div className="sk-page" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {show && <Shape />}
    </div>
  );
}

// The lesson player has its own frame (flowbar + curriculum), so it gets its
// own placeholder rather than the in-shell ones above.
export function LessonSkeleton() {
  const show = useShowAfter();
  return (
    <div className="learn-shell" role="status" aria-busy="true">
      <span className="sr-only">Opening lesson…</span>
      <div className="flowbar">
        <Brand size={28} tagline={false} />
        {show && <Line w={180} h={14} />}
      </div>
      {show && (
        <div className="lesson-wrap">
          <aside className="curriculum sk-curriculum">
            <Box h={52} r={12} />
            {Array.from({ length: 5 }, (_, i) => (
              <Line key={i} w={`${85 - (i % 2) * 20}%`} h={13} style={{ margin: "10px 6px" }} />
            ))}
          </aside>
          <div className="lesson-main">
            <div className="lesson-body">
              <div className="lesson-top">
                <Line w="55%" h={24} />
                <Line w="20%" h={11} style={{ marginTop: 10 }} />
              </div>
              <div className="lesson-content-area">
                <Box h={0} r={18} style={{ aspectRatio: "16 / 9", height: "auto" }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
