"use client";

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, GizmoHelper, GizmoViewcube, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Toolbar } from "@/src/components/ui/Toolbar";
import {
  disposeModel,
  loadModelWithTimeout,
} from "@/src/lib/converters/modelLoadPipeline";
import { useModelExport } from "@/src/hooks/useModelExport";
import { useViewerStore } from "@/src/store/useViewerStore";
import { FIT_PADDING, PARSE_YIELD_MS } from "@/src/config/constants";
import { computeModelStats, type ModelStats } from "@/src/lib/modelStats";
import { extractSceneGraph, type SceneGraphNode } from "@/src/lib/sceneGraph";

export type { ExportFormat } from "@/src/hooks/useModelExport";
export type { ModelStats } from "@/src/lib/modelStats";
export type { SceneGraphNode } from "@/src/lib/sceneGraph";

// ── Types ─────────────────────────────────────────────────────────────────

interface ThreeViewerProps {
  file: File;
  selectedUUID?: string | null;
  onLoadComplete?: () => void;
  onLoadError?: (error: unknown) => void;
  onStatsCalculated?: (stats: ModelStats | null) => void;
  onSceneGraphExtracted?: (tree: SceneGraphNode[]) => void;
}

interface SceneBootstrapProps {
  model: THREE.Group;
  onReady: () => void;
  loadId: number;
}

interface SceneModelProps {
  group: THREE.Group;
  wireframe: boolean;
  color: string;
}

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
}

const HIGHLIGHT_EMISSIVE = 0x00aaff;
const HIGHLIGHT_EMISSIVE_INTENSITY = 0.5;
const FOCUS_ANIM_SPEED = 2.5;

interface EmissiveSnapshot {
  emissive: THREE.Color;
  intensity: number;
}

function getStandardMaterials(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.filter(
    (mat): mat is THREE.MeshStandardMaterial =>
      mat instanceof THREE.MeshStandardMaterial
  );
}

function restoreAllHighlights(
  root: THREE.Object3D,
  cache: Map<THREE.Material, EmissiveSnapshot>
) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    for (const mat of getStandardMaterials(child)) {
      const snapshot = cache.get(mat);
      if (!snapshot) continue;
      mat.emissive.copy(snapshot.emissive);
      mat.emissiveIntensity = snapshot.intensity;
      mat.needsUpdate = true;
      cache.delete(mat);
    }
  });
}

function applyHighlight(
  mesh: THREE.Mesh,
  cache: Map<THREE.Material, EmissiveSnapshot>
) {
  for (const mat of getStandardMaterials(mesh)) {
    if (!cache.has(mat)) {
      cache.set(mat, {
        emissive: mat.emissive.clone(),
        intensity: mat.emissiveIntensity,
      });
    }
    mat.emissive.set(HIGHLIGHT_EMISSIVE);
    mat.emissiveIntensity = HIGHLIGHT_EMISSIVE_INTENSITY;
    mat.needsUpdate = true;
  }
}

function collectMeshesForSelection(
  root: THREE.Group,
  selectedUUID: string
): THREE.Mesh[] {
  const selected = root.getObjectByProperty("uuid", selectedUUID) as
    | THREE.Object3D
    | undefined;

  if (!selected) return [];

  if (selected instanceof THREE.Mesh) return [selected];

  const meshes: THREE.Mesh[] = [];
  selected.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  return meshes;
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

// ── Auto-center / auto-fit utilities ──────────────────────────────────────

function centerModelAtOrigin(group: THREE.Group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.sub(center);
}

function fitCameraToBox(
  group: THREE.Group,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsLike
) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
  cameraDistance *= FIT_PADDING;

  const center = box.getCenter(new THREE.Vector3());
  camera.position.set(center.x, center.y, center.z + cameraDistance);
  camera.near = cameraDistance * 0.01;
  camera.far = cameraDistance * 100;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function centerAndFitModel(
  group: THREE.Group,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControlsLike
) {
  centerModelAtOrigin(group);
  fitCameraToBox(group, camera, controls);
}

// ── SceneBootstrap — pre-compile shaders & sync render ───────────────────

function SceneBootstrap({ model, onReady, loadId }: SceneBootstrapProps) {
  const { gl, scene, camera, controls } = useThree();

  const loadIdRef = useRef(loadId);
  loadIdRef.current = loadId;

  useLayoutEffect(() => {
    if (!controls) return;
    if (!("target" in controls) || !("update" in controls)) return;

    const ctrls = controls as unknown as OrbitControlsLike;
    const cam = camera as THREE.PerspectiveCamera;
    let cancelled = false;

    centerAndFitModel(model, cam, ctrls);

    // Pre-compile shaders & force a warm-up render
    gl.compile(scene, camera);
    gl.render(scene, camera);

    // Wait for two frames so the GPU buffer swap is guaranteed
    requestAnimationFrame(() => {
      if (cancelled || loadIdRef.current !== loadId) return;
      requestAnimationFrame(() => {
        if (cancelled || loadIdRef.current !== loadId) return;
        onReady();
      });
    });

    return () => {
      cancelled = true;
    };
  }, [model, loadId, gl, scene, camera, controls, onReady]);

  return null;
}

// ── SceneModel — renders the model preserving its full hierarchy ─────────

function createStandardMaterial(color: string, wireframe: boolean) {
  return new THREE.MeshStandardMaterial({
    color,
    wireframe,
    roughness: 0.5,
    metalness: 0.5,
  });
}

function applyMeshMaterial(
  mesh: THREE.Mesh,
  color: string,
  wireframe: boolean
) {
  if (mesh.geometry) {
    mesh.geometry.computeVertexNormals();
  }

  const applyToMaterial = (current: THREE.Material): THREE.MeshStandardMaterial => {
    if (current instanceof THREE.MeshStandardMaterial) {
      current.color.set(color);
      current.wireframe = wireframe;
      current.roughness = 0.5;
      current.metalness = 0.5;
      current.needsUpdate = true;
      return current;
    }

    current.dispose();
    return createStandardMaterial(color, wireframe);
  };

  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => applyToMaterial(mat));
    return;
  }

  if (mesh.material) {
    mesh.material = applyToMaterial(mesh.material);
    return;
  }

  mesh.material = createStandardMaterial(color, wireframe);
}

function SceneModel({ group, wireframe, color }: SceneModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  // STL and similar loaders often create meshes with the default MeshBasicMaterial,
  // which ignores scene lights. Traverse the loaded group directly and force PBR materials.
  useLayoutEffect(() => {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        applyMeshMaterial(child, color, wireframe);
      }
    });
  }, [group, color, wireframe]);

  return <primitive ref={groupRef} object={group} />;
}

// ── Selection highlight + camera focus ───────────────────────────────────

interface SelectionControllerProps {
  group: THREE.Group;
  selectedUUID: string | null;
  materialColor: string;
  wireframe: boolean;
}

function SelectionController({
  group,
  selectedUUID,
  materialColor,
  wireframe,
}: SelectionControllerProps) {
  const controls = useThree((state) => state.controls);
  const emissiveCache = useRef(new Map<THREE.Material, EmissiveSnapshot>());
  const focusAnim = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    progress: number;
  } | null>(null);

  useLayoutEffect(() => {
    restoreAllHighlights(group, emissiveCache.current);
    focusAnim.current = null;

    if (!selectedUUID) return;

    const meshes = collectMeshesForSelection(group, selectedUUID);
    for (const mesh of meshes) {
      applyHighlight(mesh, emissiveCache.current);
    }

    const selected = group.getObjectByProperty("uuid", selectedUUID);
    if (!selected || !controls) return;
    if (!("target" in controls) || !("update" in controls)) return;

    const ctrls = controls as unknown as OrbitControlsLike;
    const box = new THREE.Box3().setFromObject(selected);
    const center = box.getCenter(new THREE.Vector3());

    focusAnim.current = {
      from: ctrls.target.clone(),
      to: center,
      progress: 0,
    };
  }, [group, selectedUUID, materialColor, wireframe, controls]);

  useFrame((_, delta) => {
    const anim = focusAnim.current;
    if (!anim || !controls) return;
    if (!("target" in controls) || !("update" in controls)) return;

    const ctrls = controls as unknown as OrbitControlsLike;
    anim.progress = Math.min(anim.progress + delta * FOCUS_ANIM_SPEED, 1);
    ctrls.target.lerpVectors(anim.from, anim.to, smoothStep(anim.progress));
    ctrls.update();

    if (anim.progress >= 1) {
      focusAnim.current = null;
    }
  });

  useEffect(() => {
    return () => {
      restoreAllHighlights(group, emissiveCache.current);
    };
  }, [group]);

  return null;
}

// ── SceneGrid — infinite floor grid aligned to model base ────────────────

function SceneGrid({ group, ready }: { group: THREE.Group; ready: boolean }) {
  const [layout, setLayout] = useState({
    gridY: 0,
    cellSize: 1,
    sectionSize: 5,
  });

  useLayoutEffect(() => {
    if (!ready) return;

    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const cell = maxDim / 20;

    const belowModel = box.min.y - maxDim * 0.002;
    const gridY = Math.min(belowModel, -0.01);

    setLayout({
      gridY,
      cellSize: cell,
      sectionSize: cell * 5,
    });
  }, [group, ready]);

  if (!ready) return null;

  return (
    <Grid
      position={[0, layout.gridY, 0]}
      infiniteGrid
      cellSize={layout.cellSize}
      sectionSize={layout.sectionSize}
      cellColor="#6F7D8C"
      sectionColor="#A9B1B8"
      cellThickness={0.75}
      sectionThickness={1.1}
      fadeDistance={50}
      fadeStrength={5}
      side={THREE.DoubleSide}
      renderOrder={-1}
    />
  );
}

// ── ThreeViewer ──────────────────────────────────────────────────────────

export function ThreeViewer({
  file,
  selectedUUID = null,
  onLoadComplete,
  onLoadError,
  onStatsCalculated,
  onSceneGraphExtracted,
}: ThreeViewerProps) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [isParsing, setIsParsing] = useState(true);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [activeLoadId, setActiveLoadId] = useState(0);
  const loadIdRef = useRef(0);
  const modelRef = useRef<THREE.Group | null>(null);

  const wireframe = useViewerStore((s) => s.wireframe);
  const materialColor = useViewerStore((s) => s.materialColor);
  const canvasBg = useViewerStore((s) => s.canvasBg);

  // Keep the opaque cover over the Canvas until the Fullscreen3DLoader
  // has finished its exit animation (450ms).
  const [coverVisible, setCoverVisible] = useState(true);

  // ── Export ─────────────────────────────────────────────────────────────
  const { handleExport } = useModelExport(model);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSceneReady = useCallback(() => {
    setIsSceneReady(true);
    // Trigger Fullscreen3DLoader exit animation — cover stays during fade.
    onLoadComplete?.();
    // Remove the opaque cover after the loader's fade-out (450ms) + a tiny buffer.
    window.setTimeout(() => setCoverVisible(false), 500);
  }, [onLoadComplete]);

  const handleParseError = useCallback(
    (error: unknown) => {
      setIsParsing(false);
      setCoverVisible(false);
      onLoadError?.(error);
    },
    [onLoadError]
  );

  // ── Load model whenever `file` changes ─────────────────────────────────

  useEffect(() => {
    const loadId = ++loadIdRef.current;
    setActiveLoadId(loadId);
    setIsParsing(true);
    setIsSceneReady(false);
    setCoverVisible(true);
    onStatsCalculated?.(null);
    onSceneGraphExtracted?.([]);

    // Dispose previous model before loading a new one
    if (modelRef.current) {
      disposeModel(modelRef.current);
      modelRef.current = null;
    }
    setModel(null);

    // Yield so the Fullscreen3DLoader UI has time to paint
    const parseTimer = window.setTimeout(() => {
      void (async () => {
        try {
          const group = await loadModelWithTimeout(file);

          if (loadIdRef.current !== loadId) return; // cancelled / superseded

          modelRef.current = group;
          setModel(group);
          setIsParsing(false);
        } catch (error) {
          if (loadIdRef.current !== loadId) return; // cancelled
          handleParseError(error);
        }
      })();
    }, PARSE_YIELD_MS);

    return () => {
      window.clearTimeout(parseTimer);
      // If this cleanup runs, the effect was re-run (new file), so mark
      // the in-flight load as cancelled.
      loadIdRef.current = -1;
    };
    // We intentionally depend only on `file` — the refs & callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (modelRef.current) {
        disposeModel(modelRef.current);
        modelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isSceneReady || !model) return;
    onStatsCalculated?.(computeModelStats(model));
    onSceneGraphExtracted?.(extractSceneGraph(model));
  }, [isSceneReady, model, onStatsCalculated, onSceneGraphExtracted]);

  // ── Render ─────────────────────────────────────────────────────────────

  const showViewer = !isParsing && model !== null;

  return (
    <div className="relative w-full h-full">
      <Canvas
        frameloop={showViewer && isSceneReady ? "always" : "demand"}
        camera={{ fov: 45, near: 0.1, far: 1000, position: [5, 5, 10] }}
        style={{
          background: canvasBg ?? undefined,
          transition: "background-color 0.3s ease-in-out",
        }}
        onCreated={({ camera }) => {
          // Spread the default background to avoid a flash on the very first render
          if (canvasBg) {
            (camera as THREE.PerspectiveCamera).position.set(0, 0, 5);
          }
        }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <Environment preset="city" />

        {showViewer && (
          <>
            <SceneGrid group={model!} ready={isSceneReady} />
            <SceneModel group={model!} wireframe={wireframe} color={materialColor} />
            {isSceneReady && (
              <SelectionController
                group={model!}
                selectedUUID={selectedUUID}
                materialColor={materialColor}
                wireframe={wireframe}
              />
            )}
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              minPolarAngle={0}
              maxPolarAngle={Math.PI}
            />
            <GizmoHelper alignment="bottom-right" margin={[72, 120]}>
              <GizmoViewcube
                faces={["Right", "Left", "Top", "Bottom", "Front", "Back"]}
                color="#A9C9D1"
                hoverColor="#5FBFF9"
                textColor="#111111"
                strokeColor="#333333"
                opacity={0.96}
                font="600 18px Inter, system-ui, sans-serif"
              />
            </GizmoHelper>

            {!isSceneReady && (
              <SceneBootstrap
                model={model!}
                loadId={activeLoadId}
                onReady={handleSceneReady}
              />
            )}
          </>
        )}
      </Canvas>

      {/* Opaque cover that stays visible during Fullscreen3DLoader fade-out */}
      {coverVisible && (
        <div
          className="absolute inset-0 z-[1]"
          style={{ backgroundColor: canvasBg ?? "#0a0a0a" }}
        />
      )}

      {/* Toolbar — mounted only after scene is ready */}
      {isSceneReady && (
        <Toolbar onExport={handleExport} />
      )}
    </div>
  );
}