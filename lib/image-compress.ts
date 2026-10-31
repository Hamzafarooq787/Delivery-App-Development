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
      try {
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('This image is empty or damaged.')
        // Bound both axes, including portrait photos from phones. Never upscale.
        const scale = Math.min(1, maxWidth / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement("canvas")
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error('Your browser could not prepare this photo.')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          blob => blob ? resolve(blob.type === file.type && scale === 1 && file.size < blob.size ? file : blob) : reject(new Error("Compression failed")),
          "image/jpeg",
          quality
        )
      } catch (error) { reject(error) }
      finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This photo could not be opened. Choose a JPG, PNG or WebP image.'))
    }
    img.src = url
  })
}
