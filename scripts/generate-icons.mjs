/**
 * Generates all PWA icon sizes from public/icon.svg using sharp.
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from "sharp"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

// Build a clean dark-bg SVG (the original is adaptive — we force dark for icons)
const svgSource = `<svg width="512" height="512" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" rx="37" fill="#0e0e0e"/>
  <g style="transform: scale(95%); transform-origin: center">
    <path fill="#a3a6ff"
      d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z"/>
    <path fill="#a3a6ff"
      d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z"/>
  </g>
</svg>`

// Maskable version — larger padding so logo stays within safe zone
const svgMaskable = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#0e0e0e"/>
  <svg x="64" y="64" width="384" height="384" viewBox="0 0 180 180">
    <g style="transform: scale(95%); transform-origin: center">
      <path fill="#a3a6ff"
        d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z"/>
      <path fill="#a3a6ff"
        d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z"/>
    </g>
  </svg>
</svg>`

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function generate() {
  console.log("Generating PWA icons…")

  for (const size of sizes) {
    const outPath = join(root, "public", "icons", `icon-${size}.png`)
    await sharp(Buffer.from(svgSource))
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`  ✓ icon-${size}.png`)
  }

  // Maskable icon
  const maskablePath = join(root, "public", "icons", "icon-512-maskable.png")
  await sharp(Buffer.from(svgMaskable))
    .resize(512, 512)
    .png()
    .toFile(maskablePath)
  console.log("  ✓ icon-512-maskable.png")

  console.log("\nAll icons generated in public/icons/")
}

generate().catch(console.error)
