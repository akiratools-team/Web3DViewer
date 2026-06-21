"use client";

import { useRef, useState, useEffect } from "react";
import { FolderOpen, Link } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FileInput } from "./FileInput";
import { URLLoader } from "./URLLoader";

interface FileMenuProps {
  onFile: (file: File) => void;
}

export function FileMenu({ onFile }: FileMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"file" | "url">("file");

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="absolute top-4 left-4 z-20">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Open file menu"
        aria-expanded={menuOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-600 dark:text-zinc-400 transition-colors"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="text-xs font-medium">File</span>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="file-menu"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-full left-0 mt-2 flex flex-col gap-1 px-2 py-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 min-w-[180px]"
          >
            {/* Tab buttons */}
            <div className="flex gap-1 mb-1">
              <button
                onClick={() => setActiveTab("file")}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "file"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 inline-block mr-1" />
                Device
              </button>
              <button
                onClick={() => setActiveTab("url")}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "url"
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <Link className="w-3.5 h-3.5 inline-block mr-1" />
                URL
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1">
              {activeTab === "file" && (
                <FileInput onFile={onFile} onClose={() => setMenuOpen(false)} />
              )}
              {activeTab === "url" && (
                <URLLoader onFile={onFile} onClose={() => setMenuOpen(false)} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
