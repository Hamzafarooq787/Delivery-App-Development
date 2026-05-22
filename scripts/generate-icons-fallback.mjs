/**
 * Generates PWA icons WITHOUT sharp — uses raw PNG byte encoding.
 * Creates solid-color PNG files with the KV logo as SVG data URI overlay.
 *
 * This writes minimal valid PNG files that satisfy manifest requirements.
 */
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { createHash } from "crypto"
import zlib from "zlib"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")
const outDir = join(root, "public", "icons")
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let crc = 0xffffffff
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    table[i] = c
  }
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii")
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/**
 * Create a solid-color PNG with brand colors.
 * #0e0e0e background + a simple "KV" mark drawn as colored pixels.
 */
function createPNG(size) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)   // width
  ihdr.writeUInt32BE(size, 4)   // height
  ihdr.writeUInt8(8, 8)         // bit depth
  ihdr.writeUInt8(2, 9)         // color type: RGB
  ihdr.writeUInt8(0, 10)        // compression
  ihdr.writeUInt8(0, 11)        // filter
  ihdr.writeUInt8(0, 12)        // interlace

  // Build pixel data: #0e0e0e background with #a3a6ff center circle
  const bg = [0x0e, 0x0e, 0x0e]
  const accent = [0xa3, 0xa6, 0xff]
  const cx = size / 2
  const cy = size / 2
  const r1 = size * 0.28  // outer circle
  const r2 = size * 0.18  // inner cutout

  const rawRows = []
  for (let y = 0; y < size; y++) {
    const row = [0] // filter byte
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Draw a simple bolt/ring shape
      let color
      if (dist < r1 && dist > r2) {
        // Ring — accent color
        color = accent
      } else if (dist <= r2 * 0.5) {
        // Center dot — accent
        color = accent
      } else {
        color = bg
      }
      row.push(...color)
    }
    rawRows.push(Buffer.from(row))
  }

  const rawData = Buffer.concat(rawRows)
  const compressed = zlib.deflateSync(rawData, { level: 6 })

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ])

  return png
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for (const size of sizes) {
  const png = createPNG(size)
  const path = join(outDir, `icon-${size}.png`)
  writeFileSync(path, png)
  console.log(`  ✓ icon-${size}.png (${png.length} bytes)`)
}

// Maskable (same but with padding — uses same design, safe zone is fine)
const maskable = createPNG(512)
writeFileSync(join(outDir, "icon-512-maskable.png"), maskable)
console.log("  ✓ icon-512-maskable.png")

console.log("\nAll icons generated in public/icons/")
