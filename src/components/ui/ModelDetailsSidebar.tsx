import type { ModelStats } from "@/src/lib/modelStats";

interface ModelDetailsSidebarProps {
  stats: ModelStats;
  fileName: string;
  fileSizeBytes: number;
}

function formatCount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDimension(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFileSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const GEOMETRY_ROWS: {
  label: string;
  getValue: (stats: ModelStats) => string;
}[] = [
  { label: "Vertices", getValue: (s) => formatCount(s.vertices) },
  { label: "Triangles", getValue: (s) => formatCount(s.triangles) },
  { label: "Meshes", getValue: (s) => formatCount(s.meshCount) },
  { label: "Materials", getValue: (s) => formatCount(s.materialCount) },
];

const BOUNDING_BOX_ROWS: {
  label: string;
  getValue: (stats: ModelStats) => string;
}[] = [
  { label: "Size X", getValue: (s) => formatDimension(s.sizeX) },
  { label: "Size Y", getValue: (s) => formatDimension(s.sizeY) },
  { label: "Size Z", getValue: (s) => formatDimension(s.sizeZ) },
  {
    label: "Center",
    getValue: (s) =>
      `${formatDimension(s.center.x)}, ${formatDimension(s.center.y)}, ${formatDimension(s.center.z)}`,
  },
];

function StatRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0 text-sm">
      <dt className="text-zinc-500 dark:text-zinc-500 shrink-0">{label}</dt>
      <dd
        className={[
          "font-medium tabular-nums text-zinc-800 dark:text-zinc-200 text-right",
          mono ? "font-mono text-xs tracking-tight" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

export function ModelDetailsSidebar({
  stats,
  fileName,
  fileSizeBytes,
}: ModelDetailsSidebarProps) {
  return (
    <aside
      className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm overflow-hidden"
      aria-label="Model details"
    >
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50">
        <h2 className="text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-500 mb-2">
          Model Details
        </h2>
        <p
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate"
          title={fileName}
        >
          {fileName}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
          {formatFileSize(fileSizeBytes)}
        </p>
      </div>

      <div className="flex-1 px-4 py-3 overflow-y-auto">
        <dl className="space-y-0">
          {GEOMETRY_ROWS.map(({ label, getValue }) => (
            <StatRow key={label} label={label} value={getValue(stats)} />
          ))}
        </dl>

        <p className="mt-4 mb-1 text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
          Bounding Box
        </p>
        <dl className="space-y-0">
          {BOUNDING_BOX_ROWS.map(({ label, getValue }) => (
            <StatRow key={label} label={label} value={getValue(stats)} mono />
          ))}
        </dl>
      </div>
    </aside>
  );
}
