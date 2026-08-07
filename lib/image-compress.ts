/**
 * lib/image-compress.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side image compression — resizes to maxWidth and re-encodes as JPEG
 * before upload, so a full-resolution phone photo doesn't get sent as-is.
 *
 * ⚠️  CLIENT-SIDE ONLY — uses Image/canvas, never import in server code.
 */
export async function compressImage(file: File, maxWidth = 900, quality = 0.72): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality
      )
    }
    img.onerror = reject
    img.src = url
  })
}
