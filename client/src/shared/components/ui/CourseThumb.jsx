import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { safeImageUrl } from "@/shared/lib/safeUrl";

// Course cover image. Falls back to a book-icon placeholder when there's no
// URL or the image fails to load.
//
// Sized by aspect ratio, not a pixel height: covers are 16:9 lecture banners,
// and a fixed height cropped them into a sliver whenever the card was wide
// (every card on a phone). Width comes from the container or `style`.
//
// While the file downloads it shimmers like the page skeletons, then fades
// in. One already in the browser cache shows at once, with no fade.
export function CourseThumb({ src, ratio = "16 / 9", style }) {
  const [broken, setBroken] = useState(false);
  const [load, setLoad] = useState("pending"); // pending → fade | instant
  const imgRef = useRef(null);
  src = safeImageUrl(src);
  const box = { aspectRatio: ratio, ...style };

  useEffect(() => {
    setLoad(imgRef.current?.complete ? "instant" : "pending");
  }, [src]);

  if (src && !broken) {
    return (
      <img
        ref={imgRef}
        className={
          "course-thumb" + (load === "pending" ? " skeleton is-pending" : load === "fade" ? " is-fading-in" : "")
        }
        src={src}
        alt=""
        loading="lazy"
        onLoad={() => setLoad((l) => (l === "pending" ? "fade" : l))}
        onError={() => setBroken(true)}
        style={box}
      />
    );
  }
  return (
    <div className="ph course-thumb" style={box}>
      <BookOpen />
    </div>
  );
}
