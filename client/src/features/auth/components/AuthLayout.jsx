import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlayCircle, BadgeCheck, MessagesSquare, MessageSquare, Check, Play, CodeXml, Award,
} from "lucide-react";
import Brand from "@/shared/components/layout/Brand";

const isPhone = () => window.matchMedia("(max-width: 680px)").matches;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function BrandLink() {
  return (
    <Link to="/login" className="brand">
      <Brand />
    </Link>
  );
}

// Progress ring used by both the desktop preview and the phone card. 68%.
function Ring({ count }) {
  return (
    <div className="auth-ring">
      <svg viewBox="0 0 64 64">
        <circle className="track" cx="32" cy="32" r="26" fill="none" strokeWidth="7" />
        <circle className="bar" cx="32" cy="32" r="26" fill="none" strokeWidth="7" />
      </svg>
      <b>{count}%</b>
    </div>
  );
}

// Counts 0 → 68 alongside the ring's stroke animation.
function useCountUp(target, delay) {
  const [n, setN] = useState(() => (reducedMotion() ? target : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    let t;
    const start = setTimeout(() => {
      t = setInterval(() => setN((v) => (v + 2 >= target ? (clearInterval(t), target) : v + 2)), 32);
    }, delay);
    return () => { clearTimeout(start); clearInterval(t); };
  }, [target, delay]);
  return n;
}

// Desktop / tablet: floating "continue learning" card with two pop-up notes.
function Preview() {
  const pct = useCountUp(68, 1200);
  return (
    <div className="auth-preview" aria-hidden="true">
      <div className="auth-pcard">
        <Ring count={pct} />
        <div>
          <div className="auth-pc-kicker">Continue learning</div>
          <div className="auth-pc-title">Web Development Basics</div>
          <div className="auth-pc-sub">Lesson 12 of 18 · 8 min left</div>
          <span className="auth-pc-btn"><Play fill="currentColor" />Resume lesson</span>
        </div>
      </div>
      <div className="auth-chip c1"><i><Check strokeWidth={3} /></i>Lesson 11 complete</div>
      <div className="auth-chip c2"><i><MessageSquare strokeWidth={2.5} /></i>Your teacher answered a doubt</div>
    </div>
  );
}

const STEPS = [
  { word: "Learn", Icon: PlayCircle, cap: "Video, reading & files in one place" },
  { word: "Build", Icon: CodeXml, cap: "Real projects, reviewed by your teacher" },
  { word: "Prove", Icon: Award, cap: "Certificates that show what you can do" },
];

// Phone: one headline whose verb swaps, kept in step with three swipe cards.
function PhoneShowcase({ paused }) {
  const [cur, setCur] = useState(0);
  const track = useRef(null);
  const pauseUntil = useRef(0);
  const curRef = useRef(0);
  curRef.current = cur;

  const step = () => {
    const el = track.current;
    return el.children[1].offsetLeft - el.children[0].offsetLeft;
  };

  // auto-advance; a manual swipe holds it off for a few seconds
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => {
      if (!isPhone() || paused || Date.now() < pauseUntil.current || !track.current) return;
      const next = (curRef.current + 1) % STEPS.length;
      track.current.scrollTo({ left: next * step(), behavior: "smooth" });
      setCur(next);
    }, 3200);
    return () => clearInterval(id);
  }, [paused]);

  // swiping by hand moves the headline too
  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      if (!track.current) return;
      const i = Math.max(0, Math.min(STEPS.length - 1, Math.round(track.current.scrollLeft / step())));
      if (i !== curRef.current) setCur(i);
    });
  };
  const hold = () => { pauseUntil.current = Date.now() + 6000; };

  return (
    <div className="auth-phone">
      <div className="auth-phone-head">
        <div className="auth-phone-icon" aria-hidden="true">
          {STEPS.map(({ word, Icon }, i) => <Icon key={word} className={i === cur ? "on" : ""} />)}
        </div>
        <h1 className="auth-phone-title" aria-label="Learn it. Build it. Prove it.">
          <span className="auth-slot" aria-hidden="true">
            <span className="auth-words" style={{ transform: `translateY(${-cur * 1.15}em)` }}>
              <span>Learn</span><span>Build</span><span className="gold">Prove</span>
            </span>
          </span>
          <span aria-hidden="true">&nbsp;it.</span>
        </h1>
      </div>
      <p className="auth-cap">
        {STEPS.map(({ word, cap }, i) => <span key={word} className={i === cur ? "on" : ""}>{cap}</span>)}
      </p>

      <div
        className="auth-track"
        ref={track}
        onScroll={onScroll}
        onPointerDown={hold}
        onTouchStart={hold}
        onWheel={hold}
        aria-hidden="true"
      >
        <div className="auth-mcard">
          <Ring count={68} />
          <div>
            <div className="auth-mk">Continue learning</div>
            <div className="auth-mt">Web Development Basics</div>
            <div className="auth-ms">Lesson 12 of 18</div>
          </div>
          <span className="auth-mgo"><Play fill="currentColor" /></span>
        </div>
        <div className="auth-mcard">
          <div className="auth-mico build"><CodeXml /></div>
          <div>
            <div className="auth-mk">Project</div>
            <div className="auth-mt">Portfolio website</div>
            <div className="auth-ms">Teacher replied · 2m ago</div>
          </div>
          <span className="auth-mpill ok">✓ Reviewed</span>
        </div>
        <div className="auth-mcard">
          <div className="auth-mico prove"><Award /></div>
          <div>
            <div className="auth-mk">Certificate</div>
            <div className="auth-mt">Web Development</div>
            <div className="auth-ms">Earned with 92% score</div>
          </div>
          <span className="auth-mpill gold">★ Earned</span>
        </div>
      </div>
      <div className="auth-dots" aria-hidden="true">
        {STEPS.map(({ word }, i) => <i key={word} className={i === cur ? "on" : ""} />)}
      </div>
    </div>
  );
}

// Shell for the login / signup / password pages. `shake` — bump it to shake
// the card (e.g. after a wrong password).
export default function AuthLayout({ children, shake = 0 }) {
  const [typing, setTyping] = useState(false);
  const card = useRef(null);

  useEffect(() => {
    if (!shake || !card.current) return;
    const el = card.current;
    el.classList.remove("is-shaking");
    void el.offsetWidth; // restart the animation
    el.classList.add("is-shaking");
  }, [shake]);

  // Phone: fold the hero away while a field has focus so the form gets the screen.
  const onFocus = (e) => {
    if (!isPhone() || e.target.tagName !== "INPUT") return;
    setTyping(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };
  const onBlur = (e) => {
    const panel = e.currentTarget;
    setTimeout(() => { if (!panel.contains(document.activeElement)) setTyping(false); }, 120);
  };

  return (
    <div className={"auth" + (typing ? " is-typing" : "")}>
      <aside className="auth-hero">
        <div className="auth-blob b1" />
        <div className="auth-blob b2" />
        <div className="auth-blob b3" />
        <div className="auth-grid" />

        <BrandLink />

        <div className="auth-hero-body">
          <PhoneShowcase paused={typing} />

          <div className="auth-hero-text">
            <h1>
              <span className="w">Learn it.</span> <span className="w">Build it.</span>{" "}
              <span className="w shine">Prove it.</span>
            </h1>
            <p>
              Structured courses with video, reading and downloadable material —
              track every lesson and pick up exactly where you left off.
            </p>
          </div>
          <ul className="auth-hero-list">
            <li>
              <PlayCircle />
              <span className="long">Video, reading &amp; file lessons in one place</span>
              <span className="short">Video &amp; reading lessons</span>
            </li>
            <li>
              <BadgeCheck />
              <span className="long">Progress that resumes where you stopped</span>
              <span className="short">Resume where you stopped</span>
            </li>
            <li>
              <MessagesSquare />
              <span className="long">Ask doubts and get answers from your teacher</span>
              <span className="short">Ask your teacher</span>
            </li>
          </ul>

          <Preview />
        </div>

        <div className="auth-hero-foot">© {new Date().getFullYear()} TechDea</div>
      </aside>

      <main className="auth-panel" onFocus={onFocus} onBlur={onBlur}>
        <div className="auth-card" ref={card}>{children}</div>
      </main>
    </div>
  );
}
