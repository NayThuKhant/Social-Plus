"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeCtx = { theme: string; setTheme: (t: string) => void };
const ThemeContext = createContext<ThemeCtx>({ theme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark";
    setThemeState(saved);
    document.documentElement.className = saved;
  }, []);

  function setTheme(t: string) {
    setThemeState(t);
    localStorage.setItem("theme", t);
    document.documentElement.className = t;
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
