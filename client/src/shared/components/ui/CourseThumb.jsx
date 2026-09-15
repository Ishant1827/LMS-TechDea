import { useState } from "react";
import { BookOpen } from "lucide-react";
import { safeImageUrl } from "@/shared/lib/safeUrl";

// Course cover image. Falls back to a book-icon placeholder when there's no
// URL or the image fails to load.
export function CourseThumb({ src, height = 90, style }) {
  const [broken, setBroken] = useState(false);
  src = safeImageUrl(src);
  if (src && !broken) {
    return (
      <img
        className="course-thumb"
        src={src}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        style={{ height, ...style }}
      />
    );
  }
  return (
    <div className="ph" style={{ height, ...style }}>
      <BookOpen />
    </div>
  );
}
