/**
 * Safe dynamic-import helpers for Three.js & custom loaders/exporters.
 *
 * Problem: Next.js dynamic imports (with ssr: false) return a module object that
 * may be an ESM export (`{ default: Class, NamedExport: Class }`) or a legacy
 * `module.exports = Class` bundle (`{ default: Class }`).  Directly destructuring
 * `const { Loader } = await import(...)` crashes with `undefined` if the module
 * uses a default export only.
 *
 * These helpers normalise both shapes so the rest of the codebase can always
 * write:
 *   const Loader = resolveClass(mod, "LoaderName");
 *   const instance = new Loader();
 */

/**
 * Return the exported CLASS/CONSTRUCTOR matching `exportName`.
 * Tries: mod[exportName] (named) → mod.default (default) → throws.
 */
export function resolveClass<T extends new (...args: any[]) => any>(
  mod: Record<string, any>,
  exportName: string
): T {
  if (mod[exportName]) return mod[exportName] as T;
  if (mod.default) return mod.default as T;
  throw new Error(
    `Module does not export "${exportName}" (named) nor a default export.`
  );
}

/**
 * Return the exported FUNCTION matching `exportName`.
 * Tries: mod[exportName] (named) → mod.default (default) → throws.
 */
export function resolveFunction<T extends (...args: any[]) => any>(
  mod: Record<string, any>,
  exportName: string
): T {
  if (mod[exportName]) return mod[exportName] as T;
  if (mod.default) return mod.default as T;
  throw new Error(
    `Module does not export function "${exportName}" (named) nor a default export.`
  );
}

/**
 * Return the exported object/class/function from a Three.js JSM module.
 * Three.js JSM modules typically export `{ ClassName: class, ... }` (named)
 * but some older examples export `{ default: class }`.
 */
export function resolveThreeExport<T>(
  mod: Record<string, any>,
  exportName: string
): T {
  return resolveClass<T>(mod, exportName);
}