"use client";

import { useCallback } from "react";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter.js";
import * as THREE from "three";

export type ExportFormat =
  | "gltf"
  | "glb"
  | "obj"
  | "stl-text"
  | "stl-binary"
  | "ply-text"
  | "ply-binary"
  | "off"
  | "3dm"
  | "bim";

export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  gltf: ".gltf",
  glb: ".glb",
  obj: ".obj",
  "stl-text": ".stl",
  "stl-binary": ".stl",
  "ply-text": ".ply",
  "ply-binary": ".ply",
  off: ".off",
  "3dm": ".3dm",
  bim: ".bim",
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useModelExport(model: THREE.Group | null) {
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!model) return;

      const ext = EXPORT_EXTENSIONS[format];

      switch (format) {
        case "obj": {
          const str = new OBJExporter().parse(model);
          triggerDownload(
            new Blob([str], { type: "text/plain" }),
            `model${ext}`
          );
          break;
        }

        case "stl-text": {
          const str = new STLExporter().parse(model, { binary: false }) as string;
          triggerDownload(
            new Blob([str], { type: "text/plain" }),
            `model${ext}`
          );
          break;
        }

        case "stl-binary": {
          const dv = new STLExporter().parse(model, { binary: true }) as DataView;
          triggerDownload(
            new Blob([dv.buffer as ArrayBuffer], {
              type: "application/octet-stream",
            }),
            `model${ext}`
          );
          break;
        }

        case "gltf": {
          const result = await new GLTFExporter().parseAsync(model, {
            binary: false,
          });
          const json =
            typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2);
          triggerDownload(
            new Blob([json], { type: "model/gltf+json" }),
            `model${ext}`
          );
          break;
        }

        case "glb": {
          const buf = await new GLTFExporter().parseAsync(model, {
            binary: true,
          });
          triggerDownload(
            new Blob([buf as ArrayBuffer], { type: "model/gltf-binary" }),
            `model${ext}`
          );
          break;
        }

        case "ply-text": {
          const result = new PLYExporter().parse(model, () => {}, {
            binary: false,
          });
          if (!result) return;
          triggerDownload(
            new Blob([result as string], { type: "text/plain" }),
            `model${ext}`
          );
          break;
        }

        case "ply-binary": {
          const result = new PLYExporter().parse(model, () => {}, {
            binary: true,
            littleEndian: true,
          });
          if (!result) return;
          triggerDownload(
            new Blob([result as ArrayBuffer], {
              type: "application/octet-stream",
            }),
            `model${ext}`
          );
          break;
        }

        case "off": {
          const { OFFExporter } = await import(
            "@/src/lib/converters/OFFExporter"
          );
          const str = new OFFExporter().parse(model);
          triggerDownload(
            new Blob([str], { type: "text/plain" }),
            `model${ext}`
          );
          break;
        }

        case "bim": {
          const { BIMExporter } = await import(
            "@/src/lib/converters/BIMExporter"
          );
          const str = new BIMExporter().parse(model);
          triggerDownload(
            new Blob([str], { type: "application/json" }),
            `model${ext}`
          );
          break;
        }

        case "3dm": {
          const { RhinoExporter } = await import(
            "@/src/lib/converters/RhinoExporter"
          );
          const buf = await new RhinoExporter().parse(model);
          triggerDownload(
            new Blob([buf], { type: "application/octet-stream" }),
            `model${ext}`
          );
          break;
        }
      }
    },
    [model]
  );

  return { handleExport };
}
