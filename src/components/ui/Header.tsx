"use client";

import Image from "next/image";
import { ThemeToggle } from "@/src/components/ui/ThemeToggle";

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-950/80 backdrop-blur-md flex-shrink-0 transition-colors duration-500 ease-in-out">
      <a
        href="/"
        className="flex items-center gap-3 group cursor-pointer"
        aria-label="Web3DViewer home"
      >
        <Image
          src="/Logo.png"
          alt=""
          width={36}
          height={36}
          priority
          aria-hidden
          className="h-8 sm:h-9 w-auto object-contain shrink-0 transition-opacity duration-300 ease-in-out group-hover:opacity-80 dark:brightness-110 dark:contrast-[1.02]"
          style={{ width: "auto" }}
        />
        <span className="text-base sm:text-lg font-bold tracking-tight leading-none text-slate-900 dark:text-neutral-100 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors duration-300 ease-in-out">
          Web3DViewer
        </span>
      </a>

      <ThemeToggle />
    </header>
  );
}
