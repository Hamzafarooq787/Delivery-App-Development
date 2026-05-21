"use client"

import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "mix"

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  // On mount: read localStorage and apply
  useEffect(() => {
    const saved = (localStorage.getItem("kv-theme") as Theme) || "dark"
    setThemeState(saved)
    document.documentElement.setAttribute("data-theme", saved)
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem("kv-theme", t)
    document.documentElement.setAttribute("data-theme", t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
