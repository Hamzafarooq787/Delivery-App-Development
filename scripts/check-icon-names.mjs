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
  scanIconTags(s, file)
  // icon: "name" / icon="name" / Icon: 'name' properties
  for (const m of s.matchAll(/\b[iI]con\w*\s*[:=]\s*\{?\s*["'`]([a-z][a-z0-9_]*)["'`]/g)) add(m[1], file)
}

// Finds <span className="material-symbols-outlined ..."> and reads its text child. The end of the opening tag is
// located by tracking braces/quotes, so a `>` inside an attribute expression (e.g. `count > 0 ? ...`) is not mistaken
// for the end of the tag.
function scanIconTags(s, file) {
  const marker = "material-symbols-outlined"
  let idx = 0
  while ((idx = s.indexOf(marker, idx)) !== -1) {
    // skip the rest of the className string the marker sits in
    const before = s.lastIndexOf('"', idx), beforeS = s.lastIndexOf("'", idx), beforeT = s.lastIndexOf("`", idx)
    const open = Math.max(before, beforeS, beforeT)
    let i = idx + marker.length
    if (open !== -1) {
      const close = s.indexOf(s[open], idx + marker.length)
      if (close !== -1) i = close + 1
    }
    let depth = 0
    let quote = null
    for (; i < s.length; i++) {
      const c = s[i]
      if (quote) {
        if (c === quote && s[i - 1] !== "\\") quote = null
        continue
      }
      if (c === '"' || c === "'" || c === "`") quote = c
      else if (c === "{") depth++
      else if (c === "}") depth--
      else if (c === ">" && depth <= 0 && s[i - 1] !== "=") break
    }
    const end = s.indexOf("<", i)
    const text = end === -1 ? "" : s.slice(i + 1, end).trim()
    if (/^[a-z][a-z0-9_]*$/.test(text)) add(text, file)
    else if (text.startsWith("{")) {
      const expr = text.includes("?") ? text.slice(text.indexOf("?")) : text // skip the condition
      for (const l of expr.matchAll(/["'`]([a-z][a-z0-9_]*)["'`]/g)) add(l[1], file)
    }
    idx += marker.length
  }
}

for (const d of ["app", "components"]) walk(d)
const missing = [...used].filter(([n]) => !known.has(n))
if (missing.length) {
  console.error("Icons missing from lib/material-icon-names.ts:")
  for (const [n, f] of missing) console.error(`  ${n}  (${f})`)
  process.exit(1)
}
console.log(`OK — ${used.size} icon names in use, all listed.`)
