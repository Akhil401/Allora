"use client";

import { useEffect } from "react";
import { usePreferences } from "@/presentation/stores/preferences";

/**
 * Applies the selected theme by toggling the `dark` class on <html>. Respects
 * the OS preference when theme is "system". Rendered once inside Providers.
 */
export function ThemeApplier() {
  const theme = usePreferences((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mql.matches);
      root.classList.toggle("dark", dark);
    };

    apply();
    if (theme === "system") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
  }, [theme]);

  return null;
}
