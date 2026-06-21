"use client";

import { create } from "zustand";
import type { ExportFormat } from "@/src/hooks/useModelExport";

interface ViewerState {
  wireframe: boolean;
  materialColor: string;
  canvasBg: string | null;
  exportFormat: ExportFormat;

  setWireframe: (value: boolean) => void;
  toggleWireframe: () => void;
  setMaterialColor: (color: string) => void;
  setCanvasBg: (color: string | null) => void;
  setExportFormat: (format: ExportFormat) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  wireframe: false,
  materialColor: "#8b9bb4",
  canvasBg: null,
  exportFormat: "glb",

  setWireframe: (value) => set({ wireframe: value }),
  toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
  setMaterialColor: (color) => set({ materialColor: color }),
  setCanvasBg: (color) => set({ canvasBg: color }),
  setExportFormat: (format) => set({ exportFormat: format }),
}));