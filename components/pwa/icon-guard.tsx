"use client"

import { useEffect } from "react"

/**
 * Safety net for Material Symbols icons: an icon whose name is missing from the
 * font subset (lib/material-icon-names.ts) would otherwise render its name as
 * plain text (e.g. "CHAT"). Once the icon font is ready, this finds icons that
 * rendered wider than a glyph (1em), hides them immediately, loads the full icon
 * font on demand, and shows them with it. Names that are not icons at all stay hidden.
 */
const FULL_FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1&display=block"
const SELECTOR = ".material-symbols-outlined"

let fullFont: Promise<boolean> | null = null

function loadFullFont(): Promise<boolean> {
  if (!fullFont) {
    fullFont = fetch(FULL_FONT_CSS)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("css"))))
      .then((css) => {
        const faces = css.match(/@font-face\s*\{[^}]*\}/g)?.join("\n")
        if (!faces) throw new Error("no @font-face")
        const style = document.createElement("style")
        // Own family name so it never clashes with the subset font
        style.textContent = faces.replace(/font-family:\s*['"]?Material Symbols Outlined['"]?/g, "font-family: 'Material Symbols Full'")
        document.head.appendChild(style)
        return document.fonts.load("24px 'Material Symbols Full'", "home")
      })
      .then(() => true, () => false)
  }
  return fullFont
}

// A rendered icon glyph is exactly 1em wide; leaked ligature text is several letters wide. Measure the text itself
// (a Range over the element's content), not the element box: block-level icons stretch to their container.
function leaksText(el: HTMLElement): boolean {
  const fontSize = parseFloat(getComputedStyle(el).fontSize) || 24
  const range = document.createRange()
  range.selectNodeContents(el)
  return range.getBoundingClientRect().width > fontSize * 1.25
}

function check(els: Iterable<HTMLElement>) {
  const broken: HTMLElement[] = []
  for (const el of els) {
    const text = el.textContent ?? ""
    if (el.dataset.iconChecked === text) continue
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue // not laid out yet (hidden parent): re-checked when it appears
    el.dataset.iconChecked = text
    if (leaksText(el)) {
      el.setAttribute("data-icon-broken", "")
      broken.push(el)
    } else {
      el.removeAttribute("data-icon-broken")
    }
  }
  if (broken.length === 0) return
  loadFullFont().then((ok) => {
    if (!ok) return // stay hidden: better a gap than raw text
    for (const el of broken) {
      el.setAttribute("data-icon-full", "")
      if (!leaksText(el)) el.removeAttribute("data-icon-broken") // an actual icon the subset lacked
    }
  })
}

function scan() {
  check(document.querySelectorAll<HTMLElement>(SELECTOR))
}

// Icons touched by a batch of mutations. Checked synchronously in the observer callback, which runs before the
// browser paints, so a leaked name is hidden before it is ever visible.
function iconsIn(records: MutationRecord[]): Set<HTMLElement> {
  const found = new Set<HTMLElement>()
  const addFrom = (node: Node | null) => {
    if (!node) return
    const el = node instanceof HTMLElement ? node : node.parentElement
    if (!el) return
    const self = el.closest<HTMLElement>(SELECTOR)
    if (self) found.add(self)
    if (node instanceof HTMLElement) node.querySelectorAll<HTMLElement>(SELECTOR).forEach((e) => found.add(e))
  }
  for (const r of records) {
    if (r.type === "childList") {
      addFrom(r.target)
      r.addedNodes.forEach(addFrom)
    } else {
      addFrom(r.target)
    }
  }
  return found
}

export function IconGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let domObserver: MutationObserver | undefined
    const onMutations = (records: MutationRecord[]) => {
      check(iconsIn(records))
      // Backup full pass for icons that were inside a hidden parent when they changed
      clearTimeout(timer)
      timer = setTimeout(scan, 120)
    }
    const start = () => {
      scan()
      domObserver = new MutationObserver(onMutations)
      domObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden"] })
    }

    const root = document.documentElement
    let readyObserver: MutationObserver | undefined
    if (root.getAttribute("data-icons") === "ready") {
      start()
    } else {
      // Wait until the subset font has loaded (or its timeout fired); scanning earlier would flag every icon
      readyObserver = new MutationObserver(() => {
        if (root.getAttribute("data-icons") === "ready") {
          readyObserver?.disconnect()
          start()
        }
      })
      readyObserver.observe(root, { attributes: true, attributeFilter: ["data-icons"] })
    }

    return () => {
      clearTimeout(timer)
      readyObserver?.disconnect()
      domObserver?.disconnect()
    }
  }, [])

  return null
}
