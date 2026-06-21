import { useState, useCallback, DragEvent } from "react";

const ACCEPTED_EXTENSIONS = new Set([
  // Mesh formats
  ".stl", ".obj", ".fbx",
  ".gltf", ".glb",
  ".3ds",
  ".dae", ".ply", ".wrl", ".vrml", ".off",
  // CAD (occt-import-js)
  ".step", ".stp", ".iges", ".igs",
  // Rhino
  ".3dm",
  // dotBIM
  ".bim",
]);

interface UseFileHandlerOptions {
  /** Called when a file passes validation and loading begins. */
  onValidFile?: (file: File) => void;
  /** Called when a file fails extension validation. */
  onInvalidFile?: (message: string) => void;
}

interface FileHandlerState {
  file: File | null;
  error: string | null;
  isDragActive: boolean;
  /** Increments on every accepted file — use as React key to reset the viewer. */
  loadSessionId: number;
}

interface FileHandlerHandlers {
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  clearFile: () => void;
  /** Directly load a File object — same validation as drag-and-drop. */
  loadFile: (file: File) => void;
}

export function useFileHandler(
  options?: UseFileHandlerOptions
): FileHandlerState & FileHandlerHandlers {
  const { onValidFile, onInvalidFile } = options ?? {};
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [loadSessionId, setLoadSessionId] = useState(0);

  const validateAndSet = useCallback(
    (candidate: File) => {
      const ext = "." + candidate.name.split(".").pop()?.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.has(ext)) {
        const message = `Unsupported format "${ext}". Accepted: ${[...ACCEPTED_EXTENSIONS].join(", ")}`;
        setError(message);
        setFile(null);
        onInvalidFile?.(message);
      } else {
        // Fire loader immediately — before React commits the new file / viewer state.
        onValidFile?.(candidate);
        setLoadSessionId((id) => id + 1);
        setFile(candidate);
        setError(null);
      }
    },
    [onValidFile, onInvalidFile]
  );

  const onDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setIsDragActive(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) validateAndSet(dropped);
    },
    [validateAndSet]
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
  }, []);

  return {
    file,
    error,
    isDragActive,
    loadSessionId,
    onDragOver,
    onDragLeave,
    onDrop,
    clearFile,
    loadFile: validateAndSet,
  };
}
