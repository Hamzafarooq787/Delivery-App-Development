export function driverDocumentKind(url: string): "image" | "pdf" | "unknown" {
  try {
    const path = new URL(url, "https://godrop.invalid").pathname
    if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(path)) return "image"
    if (/\.pdf$/i.test(path)) return "pdf"
  } catch { /* Unknown document reference. */ }
  return "unknown"
}
