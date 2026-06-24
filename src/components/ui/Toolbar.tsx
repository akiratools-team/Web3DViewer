"use client";

import { useRef, useEffect, useState } from "react";
import { Grid, Palette, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExportFormat } from "@/src/hooks/useModelExport";
import { useViewerStore } from "@/src/store/useViewerStore";

// ── Shared colour presets (3D printing / CAD community favourites) ───────
const COLOR_PRESETS = [
  { name: "Pure White", value: "#FFFFFF" },
  { name: "Primer Gray", value: "#A3A3A3" },
  { name: "Dark Anthracite", value: "#262626" },
  { name: "Prusa Orange", value: "#F97316" },
  { name: "Model Blue", value: "#3B82F6" },
] as const;

const MAT_PRESETS = COLOR_PRESETS;
const BG_PRESETS = COLOR_PRESETS;

const isMatPreset = (color: string) => MAT_PRESETS.some((p) => p.value === color);

const EXPORT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "gltf", label: "glTF Text (.gltf)" },
  { value: "glb", label: "glTF Binary (.glb)" },
  { value: "obj", label: "Wavefront (.obj)" },
  { value: "stl-text", label: "Stereolithography Text (.stl)" },
  { value: "stl-binary", label: "Stereolithography Binary (.stl)" },
  { value: "ply-text", label: "Polygon File Format Text (.ply)" },
  { value: "ply-binary", label: "Polygon File Format Binary (.ply)" },
  { value: "off", label: "Object File Format Text (.off)" },
  { value: "bim", label: "Dotbim (.bim)" },
];

interface ToolbarProps {
  onExport: (format: ExportFormat) => void;
}

export function Toolbar({ onExport }: ToolbarProps) {
  const wireframe = useViewerStore((s) => s.wireframe);
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe);
  const materialColor = useViewerStore((s) => s.materialColor);
  const setMaterialColor = useViewerStore((s) => s.setMaterialColor);
  const canvasBg = useViewerStore((s) => s.canvasBg);
  const setCanvasBg = useViewerStore((s) => s.setCanvasBg);
  const exportFormat = useViewerStore((s) => s.exportFormat);
  const setExportFormat = useViewerStore((s) => s.setExportFormat);

  const [matPickerOpen, setMatPickerOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const matColorInputRef = useRef<HTMLInputElement>(null);
  const bgColorInputRef = useRef<HTMLInputElement>(null);
  const matPopoverRef = useRef<HTMLDivElement>(null);
  const bgPopoverRef = useRef<HTMLDivElement>(null);
  const matBtnRef = useRef<HTMLButtonElement>(null);
  const bgBtnRef = useRef<HTMLButtonElement>(null);

  // ── Click-outside closers ──────────────────────────────────────────────
  useEffect(() => {
    if (!matPickerOpen) return;
    const handle = (e: PointerEvent) => {
      if (
        matPopoverRef.current?.contains(e.target as Node) ||
        matBtnRef.current?.contains(e.target as Node)
      )
        return;
      setMatPickerOpen(false);
    };
    window.addEventListener("pointerdown", handle);
    return () => window.removeEventListener("pointerdown", handle);
  }, [matPickerOpen]);

  useEffect(() => {
    if (!bgPickerOpen) return;
    const handle = (e: PointerEvent) => {
      if (
        bgPopoverRef.current?.contains(e.target as Node) ||
        bgBtnRef.current?.contains(e.target as Node)
      )
        return;
      setBgPickerOpen(false);
    };
    window.addEventListener("pointerdown", handle);
    return () => window.removeEventListener("pointerdown", handle);
  }, [bgPickerOpen]);

  const popAnim = {
    initial: { opacity: 0, y: 6, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 6, scale: 0.97 },
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const },
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
      {/* ── Material Colour Popover ─────────────────────────────────── */}
      <AnimatePresence>
        {matPickerOpen && (
          <motion.div
            ref={matPopoverRef}
            key="mat-color-popover"
            {...popAnim}
            className="flex flex-col gap-3 px-4 py-3 bg-white/90 dark:bg-zinc-900/75 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40"
          >
            <p className="text-zinc-500 dark:text-zinc-500 text-[10px] uppercase tracking-widest select-none">
              Material Colour
            </p>
            <div className="flex items-center gap-2">
              {MAT_PRESETS.map(({ name, value }) => (
                <motion.button
                  key={value}
                  onClick={() => {
                    setMaterialColor(value);
                    setMatPickerOpen(false);
                  }}
                  title={name}
                  aria-label={name}
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-6 h-6 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/40 transition-shadow"
                  style={{
                    backgroundColor: value,
                    boxShadow:
                      materialColor === value
                        ? `0 0 0 2px var(--ring-color, #18181b), 0 0 0 3.5px ${value}`
                        : "none",
                  }}
                />
              ))}
              <div className="relative w-6 h-6">
                <motion.button
                  onClick={() => matColorInputRef.current?.click()}
                  title="Custom colour"
                  aria-label="Open custom colour picker"
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-6 h-6 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/40 overflow-hidden border border-zinc-300 dark:border-zinc-600"
                  style={{
                    background:
                      "conic-gradient(hsl(0,90%,55%), hsl(45,90%,55%), hsl(90,90%,45%), hsl(180,90%,45%), hsl(270,90%,55%), hsl(315,90%,55%), hsl(360,90%,55%))",
                    boxShadow:
                      !isMatPreset(materialColor)
                        ? `0 0 0 2px #18181b, 0 0 0 3.5px ${materialColor}`
                        : "none",
                  }}
                />
                <input
                  ref={matColorInputRef}
                  type="color"
                  value={materialColor}
                  onChange={(e) => setMaterialColor(e.target.value)}
                  aria-label="Custom material colour"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  tabIndex={-1}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Background Colour Popover ───────────────────────────────── */}
      <AnimatePresence>
        {bgPickerOpen && (
          <motion.div
            ref={bgPopoverRef}
            key="bg-color-popover"
            {...popAnim}
            className="flex flex-col gap-3 px-4 py-3 bg-white/90 dark:bg-zinc-900/75 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40"
          >
            <p className="text-zinc-500 dark:text-zinc-500 text-[10px] uppercase tracking-widest select-none">
              Background
            </p>
            <div className="flex items-center gap-2">
              {BG_PRESETS.map(({ name, value }) => (
                <motion.button
                  key={value}
                  onClick={() => {
                    setCanvasBg(value);
                    setBgPickerOpen(false);
                  }}
                  title={name}
                  aria-label={name}
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-6 h-6 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/40 transition-shadow"
                  style={{
                    backgroundColor: value,
                    boxShadow:
                      canvasBg === value
                        ? `0 0 0 2px #18181b, 0 0 0 3.5px ${value}`
                        : "none",
                  }}
                />
              ))}
              <div className="relative w-6 h-6">
                <motion.button
                  onClick={() => bgColorInputRef.current?.click()}
                  title="Custom background"
                  aria-label="Open custom background colour picker"
                  whileHover={{ scale: 1.18 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-6 h-6 rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/40 overflow-hidden border border-zinc-300 dark:border-zinc-600"
                  style={{
                    background:
                      "conic-gradient(hsl(0,90%,55%), hsl(45,90%,55%), hsl(90,90%,45%), hsl(180,90%,45%), hsl(270,90%,55%), hsl(315,90%,55%), hsl(360,90%,55%))",
                    boxShadow:
                      canvasBg && !BG_PRESETS.some((p) => p.value === canvasBg)
                        ? `0 0 0 2px #18181b, 0 0 0 3.5px ${canvasBg}`
                        : "none",
                  }}
                />
                <input
                  ref={bgColorInputRef}
                  type="color"
                  value={canvasBg ?? "#09090b"}
                  onChange={(e) => {
                    setCanvasBg(e.target.value);
                    setBgPickerOpen(false);
                  }}
                  aria-label="Custom background colour"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  tabIndex={-1}
                />
              </div>
              {canvasBg && (
                <button
                  onClick={() => {
                    setCanvasBg(null);
                    setBgPickerOpen(false);
                  }}
                  title="Reset to theme default"
                  aria-label="Reset background to theme default"
                  className="text-[10px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-1.5 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Toolbar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 py-2 bg-white/90 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-700/60 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/30 text-zinc-800 dark:text-zinc-200">
        <span className="text-zinc-500 dark:text-zinc-600 text-[10px] uppercase tracking-widest px-2 select-none">
          View
        </span>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700/60 mx-1" />

        {/* Wireframe toggle */}
        <button
          onClick={toggleWireframe}
          aria-label="Toggle wireframe"
          aria-pressed={wireframe}
          title="Toggle Wireframe"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer",
            wireframe
              ? "bg-blue-500/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/40"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-zinc-200 border border-transparent",
          ].join(" ")}
        >
          <Grid className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Wireframe</span>
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700/60 mx-1" />

        {/* Material colour picker trigger */}
        <button
          ref={matBtnRef}
          onClick={() => setMatPickerOpen((prev) => !prev)}
          aria-label="Toggle material colour picker"
          aria-expanded={matPickerOpen}
          title="Material Colour"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border",
            matPickerOpen
              ? "bg-zinc-100 dark:bg-zinc-700/50 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-zinc-200 border-transparent",
          ].join(" ")}
        >
          <Palette className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Colour</span>
          <motion.span
            className="w-3.5 h-3.5 rounded-full border border-zinc-300 dark:border-zinc-600 flex-shrink-0"
            style={{ backgroundColor: materialColor }}
            animate={{ backgroundColor: materialColor }}
            transition={{ duration: 0.25 }}
          />
        </button>

        {/* Background colour picker trigger */}
        <button
          ref={bgBtnRef}
          onClick={() => setBgPickerOpen((prev) => !prev)}
          aria-label="Toggle background colour picker"
          aria-expanded={bgPickerOpen}
          title="Background Colour"
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border",
            bgPickerOpen
              ? "bg-zinc-100 dark:bg-zinc-700/50 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 hover:text-zinc-900 dark:hover:text-zinc-200 border-transparent",
          ].join(" ")}
        >
          <div
            className="w-3.5 h-3.5 rounded border border-zinc-300 dark:border-zinc-600 flex-shrink-0"
            style={{ backgroundColor: canvasBg ?? "#e4e4e7" }}
          />
          <span>BG</span>
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700/60 mx-2" />

        {/* Export controls */}
        <div className="flex items-center gap-1.5">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            aria-label="Select export format"
            className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 text-xs rounded-xl px-2.5 py-2 cursor-pointer appearance-none focus:outline-none focus:border-blue-500 transition-colors duration-150 hover:border-zinc-400 dark:hover:border-zinc-500"
          >
            {EXPORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <motion.button
            onClick={() => onExport(exportFormat)}
            aria-label={`Download as ${EXPORT_OPTIONS.find((o) => o.value === exportFormat)?.label ?? exportFormat}`}
            title={`Download as ${EXPORT_OPTIONS.find((o) => o.value === exportFormat)?.label ?? exportFormat}`}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors duration-150 cursor-pointer shadow-lg shadow-blue-900/40"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2} />
            Export
          </motion.button>
        </div>
      </div>
    </div>
  );
}