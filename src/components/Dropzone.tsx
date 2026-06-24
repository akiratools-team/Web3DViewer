"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import { UploadCloud, X } from "lucide-react";
import { useFileHandler } from "@/src/hooks/useFileHandler";
import { ACCEPTED_FILE_EXTENSIONS_ATTR } from "@/src/config/constants";
import { FileMenu } from "@/src/components/ui/FileMenu";
import { ModelDetailsSidebar } from "@/src/components/ui/ModelDetailsSidebar";
import { SceneGraphSidebar } from "@/src/components/ui/SceneGraphSidebar";
import { notifyModelError } from "@/src/utils/errorHandler";
import type { ModelStats } from "@/src/lib/modelStats";
import type { SceneGraphNode } from "@/src/lib/sceneGraph";

const ThreeViewer = dynamic(
  () =>
    import("@/src/components/3d/ThreeViewer").then((mod) => ({
      default: mod.ThreeViewer,
    })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full" aria-hidden />,
  }
);

interface DropzoneProps {
  onLoadingStart?: () => void;
  onLoadingEnd?: () => void;
}

export function Dropzone({ onLoadingStart, onLoadingEnd }: DropzoneProps) {
  const {
    file,
    isDragActive,
    loadSessionId,
    onDragOver,
    onDragLeave,
    onDrop,
    clearFile,
    loadFile,
  } = useFileHandler({
    onValidFile: () => onLoadingStart?.(),
    onInvalidFile: (message) => toast.error(message, { id: "file-validation-error" }),
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [sceneGraph, setSceneGraph] = useState<SceneGraphNode[]>([]);
  const [selectedUUID, setSelectedUUID] = useState<string | null>(null);

  const handleStatsCalculated = useCallback((stats: ModelStats | null) => {
    setModelStats(stats);
  }, []);

  const handleSceneGraphExtracted = useCallback((tree: SceneGraphNode[]) => {
    setSceneGraph(tree);
    setSelectedUUID(null);
  }, []);

  const handleSelectUUID = useCallback((uuid: string | null) => {
    setSelectedUUID(uuid);
  }, []);

  const handleClearFile = () => {
    onLoadingEnd?.();
    setModelStats(null);
    setSceneGraph([]);
    setSelectedUUID(null);
    clearFile();
  };

  const handleLoadComplete = () => onLoadingEnd?.();

  const handleLoadError = (error: unknown) => {
    onLoadingEnd?.();
    clearFile();
    notifyModelError(error);
  };

  // Prevent the browser from natively opening dropped files when they land
  // anywhere outside our dropzone element (e.g. on the 3D canvas or page
  // background).  Without this, Chrome navigates away for text-based formats
  // like .step or .obj.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      const syntheticDrop = {
        preventDefault: () => {},
        dataTransfer: { files: [picked] },
      } as unknown as React.DragEvent<HTMLElement>;
      onDrop(syntheticDrop);
      e.target.value = "";
    }
  };

  // ── Viewer state ──────────────────────────────────────────────
  if (file) {
    return (
      <div
        className="flex flex-col lg:flex-row w-full h-full min-h-0 gap-2"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Left — scene graph */}
        <div className="w-full lg:w-72 shrink-0 min-h-0 h-[220px] lg:h-full order-2 lg:order-1">
          {sceneGraph.length > 0 ? (
            <SceneGraphSidebar
              nodes={sceneGraph}
              selectedUUID={selectedUUID}
              onSelect={handleSelectUUID}
            />
          ) : (
            <aside className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50">
                <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                  Meshes &amp; Materials
                </h2>
              </div>
              <div className="flex-1 flex items-center justify-center px-4 py-8">
                <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center">
                  Building scene graph…
                </p>
              </div>
            </aside>
          )}
        </div>

        {/* Center — viewport */}
        <div className="relative flex-1 min-h-0 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 transition-colors duration-300 order-1 lg:order-2">
          <ThreeViewer
            key={`viewer-${loadSessionId}`}
            file={file}
            selectedUUID={selectedUUID}
            onLoadComplete={handleLoadComplete}
            onLoadError={handleLoadError}
            onStatsCalculated={handleStatsCalculated}
            onSceneGraphExtracted={handleSceneGraphExtracted}
          />

          <FileMenu onFile={loadFile} />

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearFile();
            }}
            aria-label="Remove file"
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 hover:border-red-400/60 dark:hover:border-red-500/60 hover:text-red-500 dark:hover:text-red-400 text-zinc-500 dark:text-zinc-400 transition-colors rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Remove
          </button>
        </div>

        {/* Right — model details */}
        <div className="w-full lg:w-72 shrink-0 min-h-0 h-[280px] lg:h-full order-3">
          {modelStats ? (
            <ModelDetailsSidebar
              stats={modelStats}
              fileName={file.name}
              fileSizeBytes={file.size}
            />
          ) : (
            <aside className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50">
                <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-2">
                  Model Details
                </h2>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {file.name}
                </p>
              </div>
              <div className="flex-1 flex items-center justify-center px-4 py-8">
                <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center">
                  Calculating geometry stats…
                </p>
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // ── Drop zone state ───────────────────────────────────────────
  const borderClass = isDragActive
    ? "border-blue-500 bg-blue-50/50 dark:bg-neutral-900/80 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]"
    : [
        "border-slate-300 dark:border-neutral-700",
        "bg-slate-50 dark:bg-neutral-950",
        "hover:border-slate-400 dark:hover:border-neutral-600",
        "hover:bg-slate-100/80 dark:hover:bg-neutral-900/60",
        "hover:shadow-[0_0_24px_rgba(148,163,184,0.15)] dark:hover:shadow-[0_0_24px_rgba(115,115,115,0.12)]",
      ].join(" ");
  const borderStyle = isDragActive ? "border-solid" : "border-dashed";

  return (
    <div className="relative w-full h-full min-h-0">
      <FileMenu onFile={loadFile} />

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop zone for 3D files"
        className={[
          "w-full h-full rounded-2xl border-2 transition-all duration-300 ease-in-out cursor-pointer group",
          "flex flex-col items-center justify-center gap-6 select-none outline-none",
          "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-neutral-950",
          borderStyle,
          borderClass,
        ].join(" ")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_EXTENSIONS_ATTR}
          className="hidden"
          onChange={handleInputChange}
        />

        <UploadCloud
          className={[
            "w-16 h-16 sm:w-24 sm:h-24 transition-all duration-300 ease-in-out",
            isDragActive
              ? "text-blue-500 dark:text-blue-400 scale-110"
              : "text-slate-400 dark:text-neutral-500 group-hover:text-slate-500 dark:group-hover:text-neutral-400",
          ].join(" ")}
          strokeWidth={1.25}
        />

        <div className="flex flex-col items-center gap-3 text-center px-6 max-w-2xl">
          <p
            className={[
              "text-lg sm:text-2xl font-light tracking-[0.2em] uppercase transition-colors duration-300 ease-in-out",
              isDragActive
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-neutral-400",
            ].join(" ")}
          >
            {isDragActive ? "Release to upload" : "Drag & Drop your 3D file here"}
          </p>
          <p className="text-sm font-light text-neutral-500 dark:text-neutral-500 leading-relaxed transition-colors duration-300 ease-in-out">
            or click to browse &mdash; STL &bull; OBJ &bull; FBX &bull; GLTF / GLB &bull; PLY &bull; 3MF &bull; OFF &bull; STEP &bull; IGES &bull; IFC
          </p>
        </div>
      </div>
    </div>
  );
}
