// Reports Material Symbols icon names used in the source that are missing from
// lib/material-icon-names.ts (they would render as plain text).
// Usage: pnpm check:icons
import fs from "node:fs"
import path from "node:path"

const listSrc = fs.readFileSync("lib/material-icon-names.ts", "utf8")
const known = new Set([...listSrc.matchAll(/^\s*"([a-z0-9_]+)",/gm)].map((m) => m[1]))
const used = new Map()
const add = (name, file) => name && !used.has(name) && used.set(name, file)

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(tsx?|jsx?)$/.test(e.name)) scan(p)
  }
}

function scan(file) {
  const s = fs.readFileSync(file, "utf8")
  // <span className="material-symbols-outlined ...">icon_name</span>
  for (const m of s.matchAll(/material-symbols-outlined[^>]*>\s*([a-z][a-z0-9_]*)\s*</g)) add(m[1], file)
  // {cond ? "icon_a" : "icon_b"} inside an icon span
  for (const m of s.matchAll(/material-symbols-outlined[^>]*>\s*\{([^}]*)\}/g)) {
    const expr = m[1].includes("?") ? m[1].slice(m[1].indexOf("?")) : m[1] // skip the condition
    for (const l of expr.matchAll(/["'`]([a-z][a-z0-9_]*)["'`]/g)) add(l[1], file)
  }
  // icon: "name" / icon="name" / Icon: 'name' properties
  for (const m of s.matchAll(/\b[iI]con\w*\s*[:=]\s*\{?\s*["'`]([a-z][a-z0-9_]*)["'`]/g)) add(m[1], file)
}

for (const d of ["app", "components"]) walk(d)
const missing = [...used].filter(([n]) => !known.has(n))
if (missing.length) {
  console.error("Icons missing from lib/material-icon-names.ts:")
  for (const [n, f] of missing) console.error(`  ${n}  (${f})`)
  process.exit(1)
}
console.log(`OK — ${used.size} icon names in use, all listed.`)
