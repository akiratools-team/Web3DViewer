"use client";

import { useEffect, useState } from "react";

/**
 * Detects and reacts to the <html class="dark"> toggle.
 * The MutationObserver re-renders this component whenever ThemeToggle
 * changes the <html> class, keeping the canvas background in sync.
 */
export function useTheme(): { isDark: boolean } {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const update = () => setIsDark(html.classList.contains("dark"));

    update();

    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return { isDark };
}