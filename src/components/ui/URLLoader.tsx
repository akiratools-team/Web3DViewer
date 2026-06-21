"use client";

import { useState, useRef } from "react";
import { Loader2, X, Globe } from "lucide-react";

interface URLLoaderProps {
  onFile: (file: File) => void;
  onClose: () => void;
}

export function URLLoader({ onFile, onClose }: URLLoaderProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url.trim(), {
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Extract filename from URL or Content-Disposition header
      const contentDisposition = response.headers.get("content-disposition");
      let filename = url.split("/").pop()?.split("?")[0] || "model";

      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, "");
        }
      }

      // Ensure it has an extension
      if (!filename.includes(".")) {
        const contentType = response.headers.get("content-type");
        if (contentType) {
          const extMap: Record<string, string> = {
            "model/gltf+json": ".gltf",
            "model/gltf-binary": ".glb",
            "application/octet-stream": ".stl",
            "text/plain": ".obj",
          };
          filename += extMap[contentType] || "";
        }
      }

      const file = new File([blob], filename, { type: blob.type });
      onFile(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load from URL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/model.step"
          className="w-full px-9 py-2 pl-10 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
          disabled={loading}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin inline-block mr-1" />
              Loading...
            </>
          ) : (
            "Load"
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>
      )}
    </form>
  );
}