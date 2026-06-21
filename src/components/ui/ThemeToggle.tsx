"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="w-16 h-8 rounded-full bg-slate-200 dark:bg-neutral-800 animate-pulse"
        aria-hidden
      />
    );
  }

  const isDark = (resolvedTheme ?? theme) === "dark";
  const tooltipLabel = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";

  return (
    <div className="relative group">
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={tooltipLabel}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={[
          "relative w-16 h-8 rounded-full cursor-pointer",
          "transition-colors duration-300 ease-in-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-neutral-950",
          isDark ? "bg-neutral-700" : "bg-slate-300",
        ].join(" ")}
      >
        {/* Track icons */}
        <Sun
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500 pointer-events-none"
          strokeWidth={2.5}
          aria-hidden
        />
        <Moon
          className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none"
          strokeWidth={2.5}
          aria-hidden
        />

        {/* Sliding thumb — w-16 track − w-6 thumb − 2× inset-1 (4px) = 32px travel */}
        <span
          className={[
            "absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md",
            "flex items-center justify-center",
            "transition-transform duration-300 ease-in-out",
            isDark ? "translate-x-8" : "translate-x-0",
          ].join(" ")}
          aria-hidden
        >
          {isDark ? (
            <Moon className="w-3 h-3 text-neutral-700" strokeWidth={2.5} />
          ) : (
            <Sun className="w-3 h-3 text-amber-500" strokeWidth={2.5} />
          )}
        </span>
      </button>

      {/* Hover tooltip — right-aligned so it doesn't clip off the viewport edge */}
      <div
        role="tooltip"
        className={[
          "absolute top-full right-0 mt-3 z-50",
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
          "text-[11px] font-medium tracking-wide whitespace-nowrap",
          "bg-slate-900/95 text-white",
          "dark:bg-white/95 dark:text-slate-900",
          "border border-slate-700/50 dark:border-slate-200/60",
          "backdrop-blur-md shadow-md shadow-black/15 dark:shadow-black/10",
          "origin-top-right opacity-0 scale-95 pointer-events-none",
          "group-hover:opacity-100 group-hover:scale-100",
          "transition-all duration-200",
        ].join(" ")}
      >
        {/* Arrow — right-8 aligns with center of w-16 toggle track */}
        <span
          className={[
            "absolute -top-1 right-8 w-2 h-2 rotate-45",
            "bg-slate-900/95 dark:bg-white/95",
            "border-l border-t border-slate-700/50 dark:border-slate-200/60",
          ].join(" ")}
          aria-hidden
        />
        {isDark ? (
          <Sun className="w-3 h-3 text-amber-400 dark:text-amber-500 shrink-0" strokeWidth={2} />
        ) : (
          <Moon className="w-3 h-3 text-indigo-300 dark:text-indigo-600 shrink-0" strokeWidth={2} />
        )}
        <span>{tooltipLabel}</span>
      </div>
    </div>
  );
}
