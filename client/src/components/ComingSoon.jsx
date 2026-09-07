import { Sparkles } from "lucide-react";
import Layout from "./Layout";

// Placeholder for a section whose nav + route exist but whose feature isn't built yet.
export default function ComingSoon({ title, blurb, points = [], icon: Icon = Sparkles }) {
  return (
    <Layout>
      <h2 className="page-title">{title}</h2>
      <div className="card elev-sm" style={{ alignItems: "flex-start", maxWidth: 540 }}>
        <div className="ph" style={{ width: 44, height: 44, marginBottom: 8 }}>
          <Icon />
        </div>
        <div className="card-title">Coming soon</div>
        {blurb && (
          <div className="card-meta" style={{ marginBottom: points.length ? 10 : 0 }}>
            {blurb}
          </div>
        )}
        {points.length > 0 && (
          <ul style={{ fontSize: 13, paddingLeft: 18, margin: 0, color: "var(--color-muted)" }}>
            {points.map((p, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
