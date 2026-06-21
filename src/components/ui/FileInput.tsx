"use client";

import { useRef } from "react";
import { Upload, X } from "lucide-react";

interface FileInputProps {
  onFile: (file: File) => void;
  onClose: () => void;
}

export function FileInput({ onFile, onClose }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFile(file);
      onClose();
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.obj,.fbx,.gltf,.glb,.3ds,.dae,.ply,.off,.wrl,.vrml,.step,.stp,.iges,.igs,.3dm,.bim"
        className="hidden"
        onChange={handleChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Upload className="w-3.5 h-3.5" />
        Browse Device
      </button>
    </div>
  );
}