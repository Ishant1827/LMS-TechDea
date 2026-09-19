import { Download } from "lucide-react";
import { VideoPlaceholder } from "@/shared/components/ui";
import FileViewer from "@/shared/components/lesson/FileViewer";
import { toEmbedUrl } from "@/shared/lib/lessonTypes";
import { safeUrl } from "@/shared/lib/safeUrl";
import Markdown from "@/shared/lib/markdown";

function FileCard({ url, name }) {
  const href = safeUrl(url);
  if (!href) return null;
  return (
    <a className="file-card" href={href} target="_blank" rel="noreferrer">
      <span className="file-ic">
        <Download />
      </span>
      <span>
        <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>
          {name || "Download file"}
        </span>
        <span className="muted-sm">Opens in a new tab</span>
      </span>
    </a>
  );
}

// Renders a lesson's body by type. Used by the lesson player and the
// course-details "preview first lesson" modal.
export default function LessonContent({ lesson }) {
  if (lesson.type === "video") {
    const src = toEmbedUrl(lesson.videoUrl);
    return (
      <>
        {src ? (
          <div className="video-embed">
            <iframe
              src={src}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <VideoPlaceholder />
        )}
        {lesson.content && (
          <div className="reading-body">
            <Markdown text={lesson.content} />
          </div>
        )}
        {lesson.fileUrl && (
          <>
            <div className="muted-sm" style={{ margin: "0 0 6px" }}>
              Attachment
            </div>
            <FileCard url={lesson.fileUrl} name={lesson.fileName} />
          </>
        )}
      </>
    );
  }

  if (lesson.type === "file") {
    return <FileViewer url={lesson.fileUrl} name={lesson.fileName} />;
  }

  return (
    <div className="reading-body">
      {lesson.content ? (
        <Markdown text={lesson.content} />
      ) : (
        <p>Work through the material for this lesson, then mark it complete to unlock the next one.</p>
      )}
    </div>
  );
}
