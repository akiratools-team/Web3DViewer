"use client";

import { create } from "zustand";
import type { ExportFormat } from "@/src/hooks/useModelExport";
import {
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_MATERIAL_COLOR,
} from "@/src/config/constants";

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
  materialColor: DEFAULT_MATERIAL_COLOR,
  canvasBg: null,
  exportFormat: DEFAULT_EXPORT_FORMAT,

  setWireframe: (value) => set({ wireframe: value }),
  toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
  setMaterialColor: (color) => set({ materialColor: color }),
  setCanvasBg: (color) => set({ canvasBg: color }),
  setExportFormat: (format) => set({ exportFormat: format }),
}));