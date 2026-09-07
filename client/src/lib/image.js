// Read an image File, downscale it on a canvas, and return a JPEG data URL.
// The course stores this string directly — no upload endpoint, no external host.
export function fileToResizedDataUrl(file, { maxW = 800, maxH = 800, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file chosen"));
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file"));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image couldn't be loaded"));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; // flatten any transparency
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
