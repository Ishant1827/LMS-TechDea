// Figure out how to present an attached file from its name and/or URL.

const extOf = (s = "") => {
  const clean = String(s).split(/[?#]/)[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
};

const IMAGE = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
const OFFICE = ["doc", "docx", "ppt", "pptx"];

function kindFromExt(e) {
  if (e === "pdf") return "pdf";
  if (IMAGE.includes(e)) return "image";
  if (OFFICE.includes(e)) return "office";
  return "download"; // xls, xlsx, csv, zip, unknown, no extension…
}

export function fileKind(name, url) {
  const byName = kindFromExt(extOf(name));
  if (byName !== "download") return byName;
  return kindFromExt(extOf(url));
}

export function fileExt(nameOrUrl) {
  return extOf(nameOrUrl);
}

// Microsoft's viewer needs a publicly reachable, URL-encoded source.
export function officeEmbedUrl(url) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

const driveId = (url) => {
  const m =
    url.match(/\/file\/d\/([-\w]{10,})/) ||
    url.match(/[?&]id=([-\w]{10,})/) ||
    url.match(/\/d\/([-\w]{10,})/);
  return m ? m[1] : "";
};

/**
 * Normalise a link that a teacher pasted into a preview URL + a download URL +
 * a "kind" telling FileViewer how to render it.
 *
 *   kind: "embed"  -> render previewUrl in an <iframe> (host handles the type)
 *         "pdf" / "image" / "office" -> inline by type
 *         "download" -> no preview, just the button
 */
export function resolveAttachment(name, url) {
  if (!url) return { previewUrl: "", downloadUrl: "", kind: "download" };

  // Google Drive share links — can't be framed/downloaded as-is.
  if (/drive\.google\.com/.test(url) || /docs\.google\.com/.test(url)) {
    const id = driveId(url);
    if (id) {
      return {
        previewUrl: `https://drive.google.com/file/d/${id}/preview`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
        kind: "embed",
      };
    }
  }

  // Dropbox — turn a share link into a direct one.
  if (/dropbox\.com/.test(url)) {
    const direct = url
      .replace("www.dropbox.com", "dl.dropboxusercontent.com")
      .replace(/([?&])dl=0\b/, "$1raw=1");
    return { previewUrl: direct, downloadUrl: direct, kind: fileKind(name, direct) };
  }

  return { previewUrl: url, downloadUrl: url, kind: fileKind(name, url) };
}
