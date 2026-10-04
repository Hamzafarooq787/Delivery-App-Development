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

// A rendered icon glyph is exactly 1em wide; leaked ligature text is several letters wide.
function leaksText(el: HTMLElement): boolean {
  const fontSize = parseFloat(getComputedStyle(el).fontSize) || 24
  const width = Math.max(el.getBoundingClientRect().width, el.scrollWidth)
  return width > fontSize * 1.25
}

function scan() {
  const broken: HTMLElement[] = []
  document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
    const text = el.textContent ?? ""
    if (el.dataset.iconChecked === text) return
    if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return // not laid out yet (hidden parent): re-checked when it appears
    el.dataset.iconChecked = text
    if (leaksText(el)) {
      el.setAttribute("data-icon-broken", "")
      broken.push(el)
    } else {
      el.removeAttribute("data-icon-broken")
    }
  })
  if (broken.length === 0) return
  loadFullFont().then((ok) => {
    if (!ok) return // stay hidden: better a gap than raw text
    for (const el of broken) {
      el.setAttribute("data-icon-full", "")
      if (!leaksText(el)) el.removeAttribute("data-icon-broken") // an actual icon the subset lacked
    }
  })
}

export function IconGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let domObserver: MutationObserver | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(scan, 120)
    }
    const start = () => {
      scan()
      domObserver = new MutationObserver(schedule)
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
