import { useState } from "react";
import { Download, FileText, Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import { resolveAttachment, fileExt, officeEmbedUrl } from "../lib/fileKind";

function DownloadButton({ url, name, secondary }) {
  return (
    <a
      className={"btn " + (secondary ? "btn-secondary" : "btn-primary")}
      href={url}
      download={name || ""}
      target="_blank"
      rel="noreferrer"
    >
      <Download />
      Download
    </a>
  );
}

// Shows an attached file as best it can for its type, with a Download button on
// the right. PDFs and images render inline; Word / PowerPoint use the Office
// Online viewer; Google Drive / Dropbox links are normalised and embedded;
// everything else (Excel, CSV, zip, …) is download-only.
export default function FileViewer({ url, name }) {
  const [imgBroken, setImgBroken] = useState(false);

  if (!url) {
    return (
      <p className="text-muted" style={{ marginBottom: 18 }}>
        No file attached yet.
      </p>
    );
  }

  const { previewUrl, downloadUrl, kind } = resolveAttachment(name, url);
  const label = name || `File${fileExt(url) ? "." + fileExt(url) : ""}`;

  if (kind === "download") {
    return (
      <div className="file-viewer file-viewer--card">
        <span className="file-ic">
          <FileSpreadsheet />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, wordBreak: "break-word" }}>{label}</div>
          <div className="muted-sm">Download to open this file</div>
        </div>
        <DownloadButton url={downloadUrl} name={name} />
      </div>
    );
  }

  const TypeIcon = kind === "image" ? ImageIcon : FileText;

  return (
    <div className="file-viewer">
      <div className="file-viewer-bar">
        <span className="file-viewer-name">
          <TypeIcon />
          {label}
        </span>
        <DownloadButton url={downloadUrl} name={name} />
      </div>

      <div className="file-viewer-body">
        {kind === "embed" && <iframe src={previewUrl} title={label} allow="autoplay" />}

        {kind === "pdf" && (
          <object data={previewUrl} type="application/pdf" aria-label={label}>
            <div className="file-viewer-fallback">
              Couldn't show the PDF here.
              <DownloadButton url={downloadUrl} name={name} secondary />
            </div>
          </object>
        )}

        {kind === "image" &&
          (imgBroken ? (
            <div className="file-viewer-fallback">
              Couldn't load the image.
              <DownloadButton url={downloadUrl} name={name} secondary />
            </div>
          ) : (
            <img src={previewUrl} alt={label} onError={() => setImgBroken(true)} />
          ))}

        {kind === "office" && <iframe src={officeEmbedUrl(previewUrl)} title={label} />}
      </div>

      {kind === "office" && (
        <div className="muted-sm" style={{ marginTop: 6 }}>
          Preview by Microsoft Office Online — needs a public link. If it doesn't load, use Download.
        </div>
      )}
      {kind === "embed" && (
        <div className="muted-sm" style={{ marginTop: 6 }}>
          Shared-drive preview. If it asks for access, the file's sharing must be set to “Anyone with
          the link”.
        </div>
      )}
    </div>
  );
}
