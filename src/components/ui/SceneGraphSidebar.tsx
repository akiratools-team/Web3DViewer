import type { SceneGraphNode } from "@/src/lib/sceneGraph";
import { Box, Layers } from "lucide-react";

interface SceneGraphSidebarProps {
  nodes: SceneGraphNode[];
  selectedUUID: string | null;
  onSelect: (uuid: string | null) => void;
}

function NodeIcon({ type }: { type: SceneGraphNode["type"] }) {
  if (type === "Mesh") {
    return <Box className="w-3.5 h-3.5 shrink-0 text-blue-500 dark:text-blue-400" strokeWidth={1.75} />;
  }
  return <Layers className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />;
}

function SceneGraphList({
  nodes,
  depth = 0,
  selectedUUID,
  onSelect,
}: {
  nodes: SceneGraphNode[];
  depth?: number;
  selectedUUID: string | null;
  onSelect: (uuid: string | null) => void;
}) {
  return (
    <ul className={depth === 0 ? "space-y-0.5" : "mt-0.5 space-y-0.5 border-l border-zinc-200 dark:border-zinc-700 ml-2 pl-2"}>
      {nodes.map((node) => {
        const isSelected = selectedUUID === node.id;

        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(isSelected ? null : node.id)}
              className={[
                "w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-sm transition-colors text-left cursor-pointer",
                isSelected
                  ? "bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/40"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
              ].join(" ")}
              style={{ paddingLeft: depth === 0 ? undefined : `${depth * 4 + 8}px` }}
            >
              <NodeIcon type={node.type} />
              <span className="truncate flex-1" title={node.name}>
                {node.name}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600 shrink-0">
                {node.type}
              </span>
            </button>
            {node.children && node.children.length > 0 && (
              <SceneGraphList
                nodes={node.children}
                depth={depth + 1}
                selectedUUID={selectedUUID}
                onSelect={onSelect}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SceneGraphSidebar({
  nodes,
  selectedUUID,
  onSelect,
}: SceneGraphSidebarProps) {
  return (
    <aside
      className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
      aria-label="Scene graph"
    >
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 shrink-0">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
          Meshes &amp; Materials
        </h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          {nodes.length > 0 ? "Scene hierarchy" : "No objects"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {nodes.length > 0 ? (
          <SceneGraphList nodes={nodes} selectedUUID={selectedUUID} onSelect={onSelect} />
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center px-4 py-8">
            No meshes or groups found.
          </p>
        )}
      </div>
    </aside>
  );
}
