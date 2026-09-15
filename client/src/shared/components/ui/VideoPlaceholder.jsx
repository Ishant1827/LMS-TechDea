import { Play } from "lucide-react";

// The lesson video is never uploaded/stored — this stands in for the player.
export function VideoPlaceholder({ height = 220 }) {
  return (
    <div
      className="media"
      style={{ height, marginBottom: 16, flexDirection: "column", gap: 8 }}
    >
      <Play />
      <span style={{ fontSize: 12 }}>Video placeholder</span>
    </div>
  );
}
