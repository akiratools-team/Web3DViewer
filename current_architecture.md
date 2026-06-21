# Web3DViewer — Current Architecture (As-Is)

> **Date:** 2026-06-21
> **Status:** Pre-refactoring snapshot
> **Goal:** Understand the "As-Is" state before addressing performance issues and fragmented logic.

---

## 1. Directory Structure & Core Modules

```
root/
├── app/
│   ├── layout.tsx          Global layout, fonts, ThemeProvider, ToastProvider
│   ├── page.tsx            Entry page: Fullscreen3DLoader + Dropzone
│   └── globals.css         Tailwind v4 base, dark variant, loader-shimmer keyframes
│
├── public/
│   ├── Logo.png            Application logo
│   ├── occt-import-js.wasm OpenCascade WASM binary (STEP/IGES parsing)
│   └── *.svg               Default Next.js favicons
│
├── src/
│   ├── components/
│   │   ├── 3d/
│   │   │   ├── ThreeViewer.tsx     MAIN 3D HUB — Canvas, SceneModel, SceneBootstrap,
│   │   │   │                       auto-center/fit, export handlers, load orchestration
│   │   │   └── ViewCube.tsx        (broken/unused) Simple corner cube widget
│   │   │
│   │   ├── ui/
│   │   │   ├── Header.tsx              Logo + site name + ThemeToggle
│   │   │   ├── Toolbar.tsx             Bottom toolbar: wireframe, colour, bg, export selector
│   │   │   ├── Fullscreen3DLoader.tsx  Loading overlay (breathing logo + shimmer bar)
│   │   │   ├── ThemeToggle.tsx         iOS-style dark/light switch
│   │   │   ├── FileMenu.tsx            Top-left "File" dropdown (Device / URL tabs)
│   │   │   ├── FileInput.tsx           Hidden `<input type="file">` trigger
│   │   │   └── URLLoader.tsx           Fetch-from-URL input
│   │   │
│   │   ├── providers/
│   │   │   ├── ThemeProvider.tsx    next-themes wrapper (attribute="class")
│   │   │   └── ToastProvider.tsx    react-hot-toast global Toaster
│   │   │
│   │   └── Dropzone.tsx            THE FILE GATEKEEPER — drag/drop zone + viewer container
│   │
│   ├── hooks/
│   │   ├── useFileHandler.ts       File validation, extension whitelist, loadSessionId
│   │   └── useTheme.ts             MutationObserver-based dark detection (redundant)
│   │
│   ├── lib/converters/
│   │   ├── loaderHub.ts            Format → loader dispatch switch
│   │   ├── modelLoadPipeline.ts    disposeModel(), loadModelWithTimeout(), timeout promise
│   │   ├── cadLoader.ts            CAD loader: worker spawn + BufferGeometry reconstruction
│   │   ├── cadTessellation.ts      Tessellation params for occt-import-js
│   │   ├── rhinoLoader.ts          Rhino 3DM loader (CDN-based rhino3dm)
│   │   ├── OFFLoader.ts            Custom OFF format reader
│   │   ├── BIMLoader.ts            Custom dotBIM JSON parser
│   │   ├── resolveExport.ts        Dynamic-import helper for ESM/CJS modules
│   │   ├── BIMExporter.ts          dotBIM JSON export
│   │   ├── OFFExporter.ts          OFF text export
│   │   └── RhinoExporter.ts        3DM binary export (CDN-based rhino3dm)
│   │
│   ├── utils/
│   │   └── errorHandler.ts         parseModelError() + notifyModelError() via toast
│   │
│   └── workers/
│       └── cadParser.worker.ts     Web Worker: occt-import-js + Transferable packing
│
├── next.config.ts          Webpack fallbacks (fs, path, ws, net, crypto → false)
├── package.json            Next 16.2.7, Three.js 0.184.0, R3F 9.6.1, Drei 10.7.7
└── tsconfig.json           Standard Next.js config
```

### Module Responsibility Summary

| Layer | Files | Role |
|-------|-------|------|
| **Entry** | `app/page.tsx`, `app/layout.tsx` | Shell: global providers, loading state, page layout |
| **UI Shell** | `Header`, `Toolbar`, `Dropzone`, `Fullscreen3DLoader`, `ThemeToggle`, `FileMenu` | React components with zero 3D logic |
| **3D Hub** | `ThreeViewer.tsx` | Canvas, scene graph, materials, camera, load orchestration |
| **File I/O** | `useFileHandler.ts`, `Dropzone.tsx`, `FileInput.tsx`, `URLLoader.tsx` | File acquisition + validation |
| **Loaders** | `loaderHub.ts`, `*Loader.ts` in `lib/converters/`, `workers/` | Format parsing → `THREE.Group` |
| **Exporters** | `*Exporter.ts` in `lib/converters/` | `THREE.Object3D` → file blob |
| **Error** | `errorHandler.ts` | Raw errors → user-facing strings → toast |
| **Providers** | `ThemeProvider`, `ToastProvider` | Cross-cutting concerns |

---

## 2. User Flow & Core Logic

### Flow: File Upload → Render

```
User drops/browses file
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Dropzone                                                     │
│  - useFileHandler.validateAndSet()                          │
│  - Checks ACCEPTED_EXTENSIONS set                           │
│  - On valid: onValidFile() → page sets isLoading(true)     │
│  - On invalid: toast.error() (no loader, stays on dropzone) │
│  - Increments loadSessionId (React key for clean remount)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ ThreeViewer (remounted via key=loadSessionId)               │
│                                                              │
│  1. setActiveLoadId(++loadIdRef)                            │
│  2. setIsParsing(true), setIsSceneReady(false)              │
│  3. disposeModel() old model ref                            │
│                                                              │
│  4. setTimeout(50ms) ← YIELD so loader animates             │
│     │                                                        │
│     ▼                                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ loadModelWithTimeout(file) ← 45s timeout              │  │
│  │   └─ loadModel(file) → loaderHub.ts                   │  │
│  │        switch(ext) → dynamic import per-format loader  │  │
│  │        Returns THREE.Group                            │  │
│  │                                                        │  │
│  │  CAD path (step/stp/iges/igs):                         │  │
│  │    cadLoader.ts → Worker + occt-import-js (WASM)      │  │
│  │    Worker parses, packs mesh buffers as Transferables  │  │
│  │    Main thread: buildMesh() → BufferGeometry views     │  │
│  │                                                        │  │
│  │  Rhino path (3dm):                                     │  │
│  │    rhinoLoader.ts → CDN script tag → rhino3dm API      │  │
│  │    convertRhinoMesh() → BufferGeometry + MeshStdMat   │  │
│  │                                                        │  │
│  │  Standard path:                                        │  │
│  │    Three.js loaders (STL, OBJ, FBX, GLTF, etc.)        │  │
│  │    → returns Group                                     │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │                                      │
│                      ▼                                      │
│  setModel(group), setIsParsing(false)                       │
│                                                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ Canvas renders (frameloop="always")                         │
│  - <SceneModel> applies MeshStandardMaterial (useLayout)   │
│  - <OrbitControls> attaches                                 │
│  - <SceneBootstrap> fires:                                  │
│      1. centerAndFitModel()                                 │
│      2. gl.compile(scene, camera)                           │
│      3. gl.render(scene, camera)                            │
│      4. rAF → rAF → onReady()                               │
│                                                              │
│  onReady():                                                  │
│    setIsSceneReady(true)                                     │
│    onLoadComplete() → page: setIsLoading(false)             │
│    setTimeout(500ms) → coverVisible(false)                  │
│    → Toolbar renders (isSceneReady)                         │
└─────────────────────────────────────────────────────────────┘
```

### Flow: Export

```
User selects format in Toolbar select → clicks Export
        │
        ▼
ThreeViewer.handleExport(format)
  │
  ├─ OBJ       → OBJExporter.parse(model) → text blob
  ├─ STL-text  → STLExporter({ binary: false })
  ├─ STL-binary → STLExporter({ binary: true })
  ├─ GLTF      → GLTFExporter.parseAsync({ binary: false })
  ├─ GLB       → GLTFExporter.parseAsync({ binary: true })
  ├─ PLY-text  → PLYExporter({ binary: false })
  ├─ PLY-binary → PLYExporter({ binary: true })
  ├─ OFF       → OFFExporter (dynamic import)
  ├─ BIM       → BIMExporter (dynamic import)
  └─ 3DM       → RhinoExporter (dynamic import, CDN rhino3dm)
        │
        ▼
  triggerDownload(blob, filename)
```

---

## 3. State Management

**There is no global state management library (no Zustand, Redux, or React Context for app state).** All state is local `useState` / `useCallback` drilled through props across 2–4 component layers.

### State inventory

| State variable | Owner | Purpose |
|---------------|-------|---------|
| `file` | `useFileHandler` (hook, local to Dropzone) | Current selected File object |
| `error` | `useFileHandler` | Extension validation error string |
| `isDragActive` | `useFileHandler` | Drag-over visual state |
| `loadSessionId` | `useFileHandler` | Counter: forces ThreeViewer remount |
| `isLoading` | `page.tsx` | Fullscreen3DLoader visibility |
| `model` | `ThreeViewer` | `THREE.Group \| null` — the parsed 3D scene |
| `isParsing` | `ThreeViewer` | True during loadModelWithTimeout |
| `isSceneReady` | `ThreeViewer` | True after SceneBootstrap finishes |
| `activeLoadId` | `ThreeViewer` | Load identity for race-condition guard |
| `coverVisible` | `ThreeViewer` | Opaque overlay while loader fades out |
| `wireframe` | `ThreeViewer` | Wireframe toggle state |
| `materialColor` | `ThreeViewer` | Mesh material override colour |
| `canvasBg` | `ThreeViewer` | Scene background colour / null |
| `exportFormat` | `Toolbar` | Currently selected export format in dropdown |
| `matPickerOpen` / `bgPickerOpen` | `Toolbar` | Popover open/close booleans |
| `menuOpen` | `FileMenu` | File menu dropdown state |
| `activeTab` | `FileMenu` | "Device" vs "URL" tab |
| `url` / `loading` / `error` | `URLLoader` | URL fetch form state |
| `mounted` | `ThemeToggle` | Hydration guard |
| `theme` / `resolvedTheme` | `next-themes` (Context) | System + user theme |

### Communication pattern

```
page.tsx
  │ useState: isLoading
  │ callbacks: handleLoadingStart, handleLoadingEnd
  │
  └── Dropzone
        │ useFileHandler: file, error, loadSessionId, ...
        │ props: onLoadingStart, onLoadingEnd
        │
        └── ThreeViewer (key=loadSessionId)
              │
              ├── SceneModel (props: group, wireframe, color)
              ├── SceneBootstrap (props: model, loadId, onReady)
              └── Toolbar (props: callbacks up)
```

### Issues with this pattern

1. **Deep prop drilling** — `onColorChange`, `onBgColorChange`, `wireframe` pass through three layers (ThreeViewer → Toolbar → popover buttons).
2. **No shared "current model" context** — Export handlers in ThreeViewer need `file.name` (drilled) and `model` (local state).
3. **`useTheme.ts` is redundant** — duplicates `useTheme()` from `next-themes`.
4. **`coverVisible` is a workaround** — exists solely to bridge the Fullscreen3DLoader fade-out timing gap.

---

## 4. Memory Leak Detection

### What `disposeModel()` does (correctly)

```typescript
// modelLoadPipeline.ts
object.traverse((child) => {
  const mesh = child as THREE.Mesh;
  if (!mesh.isMesh) return;
  mesh.geometry?.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => {
    material.dispose();
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) { value.dispose(); }
    }
  });
});
```

### Properly disposed paths

| Path | How |
|------|-----|
| Model replaced (new file drop) | `useEffect(file)` checks `modelRef.current`, calls `disposeModel()` before setting new model |
| ThreeViewer unmount | `useEffect(() => () => { disposeModel(modelRef.current); })` |
| SceneModel cleanup | `useLayoutEffect` return — calls `disposeModel(group)` |
| Load cancelled (race) | `disposeModel(group)` in catch before `return` |
| loadSessionId mismatch | `disposeModel(group)` in catch block |

### MEMORY LEAK RISKS (ordered by severity)

#### HIGH — `rhinoLoader.ts` never disposes

```typescript
// rhinoLoader.ts — convertRhinoMesh()
const geometry = new THREE.BufferGeometry();
// ...
const material = new THREE.MeshStandardMaterial({...});
return new THREE.Mesh(geometry, material);
```

These meshes are returned in a Group that is fed into ThreeViewer. When the viewer disposes the model, `disposeModel()` DOES traverse the group and calls `.dispose()` on geometry + materials. **However**, the rhino meshes carry a `new THREE.MeshStandardMaterial` WITHOUT `userData.hasLoaderMaterial = true`, so **SceneModel unconditionally replaces** this material:

```typescript
if (mesh.material && !mesh.userData.hasLoaderMaterial) {
  const old = ...;
  old.forEach((m) => m.dispose());  // ← disposes rhino's material ✓
}
```

**Risk: LOW** — actually OK because SceneModel disposes the old material. Cascade works because rhino meshes are in the same Group ref tracked by `modelRef`.

#### HIGH — `SceneModel` creates new materials but the **BEFORE** snapshot shows old material disposal

```typescript
// ThreeViewer.tsx SceneModel
group.traverse((child) => {
  const mesh = child as THREE.Mesh;
  if (!mesh.isMesh) return;

  if (mesh.material && !mesh.userData.hasLoaderMaterial) {
    const old = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    old.forEach((m: THREE.Material) => m.dispose());
  }

  const mat = new THREE.MeshStandardMaterial({...});
  mesh.material = mat;
  newMats.push(mat);
});
```

**Risk: LOW** — old materials disposed before replacement. `materialsRef.current` tracks new mats, and the cleanup return disposes them via `disposeModel(group)`.

#### MODERATE — OFFLoader and custom loaders don't set `hasLoaderMaterial`

OFFLoader returns a geometry attached to a `new THREE.Mesh(geometry)`. The material here defaults to `MeshBasicMaterial` which is then replaced by SceneModel. Since the mesh is in the tracked group, it gets disposed. **Risk: LOW.**

#### MODERATE — `ViewCube.tsx` creates geometries and materials but NEVER disposes them

```typescript
// ViewCube.tsx (not rendered anywhere in the current Canvas)
new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1).trim(...));
new THREE.LineBasicMaterial({ color: 0xffffff });
new THREE.AxesHelper(0.5);
```

These are created in a `useEffect` with no cleanup return → **leaked** if the component ever mounts. Currently the component is **not rendered anywhere**, so this is dormant but technically a leak.

#### MODERATE — `BIMLoader` clones geometries

```typescript
geometry = baseGeometry.clone();  // cloned but never disposed independently
```

When BIM elements have element-specific colors, `clone()` is called. These clones are **not explicitly disposed** — only the base geometry in the Map is available for disposal. The cloned geometry may survive when the group is disposed via `disposeModel()`, because `disposeModel()` traverses meshes and disposes `mesh.geometry`, which is the **clone**, so **this IS disposed correctly**.

**Risk: LOW** — `disposeModel` traverses all meshes in the Group and disposes `mesh.geometry` which is the clone reference.

#### MODERATE — `BIMExporter` and `OFFExporter` read geometry attributes by `.getX(i)` inside loops

No leak issue, but the `BIMExporter` exports `mesh.uuid` (a runtime string) as the mesh identifier, which is **not deterministic** across page loads. Re-importing a BIM export via `BIMLoader` will see the UUID as `mesh_id` but the loader treats it opaquely. Not a memory issue, but a correctness concern for round-tripping.

---

## 5. Technical Debt & Inconsistencies

### 5.1 "Frankenstein" Tight Coupling

#### Issue A — `ThreeViewer.tsx` does too many things

`ThreeViewer.tsx` (482 lines) is a monolith that handles:

- Canvas creation (`@react-three/fiber <Canvas>`)
- File parsing orchestration (effect + timeout)
- Material management (`SceneModel`)
- Auto-centering (utility functions)
- Shader pre-compilation (`SceneBootstrap`)
- Fullscreen loader cover state
- Export handler with 10 format cases
- Wireframe, material colour, background colour state

**This violates the separation of concerns guideline in `.cursorrules`.** Scene-level 3D logic (auto-fit, compile) is mixed with export logic and UI state (`coverVisible`).

#### Issue B — Dropzone is both a landing page AND a viewer container

```tsx
// Dropzone.tsx
if (file) {
  return <div><ThreeViewer /><FileMenu /><RemoveButton /><InfoBadge /></div>;
}
// else
return <div><FileMenu /><FileDropZone /></div>;
```

The same component toggles between "drop zone" and "viewer + menus" based on `file !== null`. The viewer container layout (absolute-positioned menus, badges, buttons) is colocated with the drop zone layout. This makes it hard to change one without affecting the other.

#### Issue C — Error handling is split across three files with overlapping logic

| File | What it does |
|------|-------------|
| `modelLoadPipeline.ts` | `normalizeLoadError()` (now unused — replaced by `parseModelError`) |
| `errorHandler.ts` | `parseModelError()` + `notifyModelError()` (the active one) |
| `ThreeViewer.tsx` | `handleParseError()` — calls `onLoadError` |
| `Dropzone.tsx` | `handleLoadError()` — calls `notifyModelError` |
| `useFileHandler.ts` | `onInvalidFile` callback |

The old `normalizeLoadError()` in `modelLoadPipeline.ts` is **dead code** — the import was updated to `parseModelError` from `errorHandler.ts`, but the old export constants (`LOAD_ERROR_GENERIC`, `LOAD_ERROR_TIMEOUT`) are still re-exported with deprecation comments.

### 5.2 Inconsistent Coding Styles

| Area | Style Used | Conflict |
|------|-----------|----------|
| Classnames | `[].join(" ")`, template literals, raw strings — mixed | Some use join arrays, some use backtick strings with line breaks |
| Export/import | `export function`, `export class`, `export default` mixed | Dropzone uses named export, page imports via dynamic + `then(mod => ({ default: mod }))` |
| Error messages | Some throw `string`, some throw `Error(string)`, some throw `new Error(...)` | Worker uses `err.message`, main thread wraps in `Error()` |
| Three.js imports | `import * as THREE from "three"` AND `import { ... } from "three"` | BIMLoader/OFFLoader use default import, loaders use destructured |
| Async patterns | `async/await`, `.then().catch()`, `void async () => {}` | ThreeViewer parse uses `void (async () => { try/catch/finally })()` while cadLoader uses `new Promise((resolve, reject) => { worker.onmessage })` |

### 5.3 Dead / Unused Code

| File | Why it's dead |
|------|---------------|
| `ViewCube.tsx` | Not rendered anywhere in the Canvas |
| `useTheme.ts` | Duplicates `useTheme()` from `next-themes`; not imported anywhere |
| `resolveExport.ts` (Three.js helper) | Not imported by any file |
| `modelLoadPipeline.ts` `LOAD_ERROR_GENERIC` / `LOAD_ERROR_TIMEOUT` | Re-exported for backward compat but marked `@deprecated` |
| `modelLoadPipeline.ts` `normalizeLoadError` | Function body was replaced by `parseModelError` import; this function no longer exists in the current version |

### 5.4 Hardcoded Values (Low Risk but Noted)

- `PARSE_YIELD_MS = 50` in `ThreeViewer.tsx`
- `MODEL_LOAD_TIMEOUT_MS = 45_000` in `modelLoadPipeline.ts`
- `DEFAULT_COLOR = "#8b9bb4"` duplicated in `ThreeViewer.tsx`, `cadLoader.ts`, `rhinoLoader.ts`, `BIMLoader.tsx`
- `FIT_PADDING = 1.5` in `ThreeViewer.tsx`
- `loader-shimmer` animation duration hardcoded in `globals.css`
- CDN URL for rhino3dm hardcoded in two files: `rhinoLoader.ts` and `RhinoExporter.ts`

### 5.5 Format Support Asymmetry

| Format | Load | Export | Notes |
|--------|------|--------|-------|
| gltf | ✓ | ✓ | Text + Binary variants |
| glb | ✓ | ✓ | |
| obj | ✓ | ✓ | |
| stl | ✓ | ✓ | Text + Binary variants |
| ply | ✓ | ✗ | Loads PLY files but has no PLY exporter |
| off | ✓ | ✓ | Custom OFF loader + exporter |
| 3ds | ✓ | ✗ | |
| dae | ✓ | ✗ | |
| wrl/vrml | ✓ | ✗ | |
| step/stp | ✓ | ✗ | |
| iges/igs | ✓ | ✗ | |
| 3dm | ✓ | ✓ | |
| bim | ✓ | ✓ | |
| fbx | ✓ | ✗ | |
| ifc | ✗ | ✗ | Stub throws error |

### 5.6 Race Condition Handling

The load-orchestration in ThreeViewer uses two concurrent guard mechanisms:

1. **`cancelled` flag** — set to true on effect cleanup (file change, unmount)
2. **`loadIdRef.current !== loadId`** — increments on each load attempt

This is robust but **adds complexity** to an already dense `useEffect`. Both guards serve the same purpose (the ref is Reset on every render via `++loadIdRef.current`, while `cancelled` covers the interval between effect teardown and the next run). The dual system is defensive but confusing.

### 5.7 Worker Import Path

```typescript
const worker = new Worker(
  new URL("../../workers/cadParser.worker.ts", import.meta.url)
);
```

This `import.meta.url` idiom is a **Webpack 5 / TurboPack convention** that breaks if the bundler changes. The relative path is fragile (depends on `cadLoader.ts` staying in `src/lib/converters/`). A more portable approach would use Next.js worker conventions or a dedicated `getWorkerUrl()` helper.

---

## Summary of Critical Issues to Address

| Priority | Issue | Impact |
|----------|-------|--------|
| P0 | ThreeViewer.tsx monolith (482 lines) | Hard to reason about, test, or refactor. Scene logic + export logic + UI state in one file. |
| P1 | No global state | Deep prop drilling; `coverVisible` hack; model not accessible by Toolbar without callbacks |
| P1 | Dropzone dual-mode component | Tightly couples landing layout with viewer chrome; hard to add e.g. a settings sidebar |
| P2 | Dead code accumulation | `ViewCube.tsx`, `useTheme.ts`, `resolveExport.ts` helpers, deprecated exports in`modelLoadPipeline.ts` |
| P2 | Circular dependency risk | `ThreeViewer` imports `modelLoadPipeline`, which imports `loaderHub`, which dynamically imports all loaders including `cadLoader` (which spawns the worker) |
| P2 | Off-loader materials lack `hasLoaderMaterial` | OFFLoader meshes use default material that SceneModel replaces — works but inconsistent with other loaders |
| P3 | PLY loads but cannot export | Asymmetric format support confuses users |
| P3 | Export/import style inconsistency | 5 different import patterns in the codebase |
