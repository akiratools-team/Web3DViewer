"use client";

import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Toolbar } from "@/src/components/ui/Toolbar";
import {
  disposeModel,
  loadModelWithTimeout,
} from "@/src/lib/converters/modelLoadPipeline";
import { useModelExport } from "@/src/hooks/useModelExport";
import { useViewerStore } from "@/src/store/useViewerStore";

export type { ExportFormat } from "@/src/hooks/useModelExport";

const FIT_PADDING = 1.5;
/** Yield so Fullscreen3DLoader can paint before CPU-heavy parsing. */
const PARSE_YIELD_MS = 50;

// ── Types ─────────────────────────────────────────────────────────────────

interface ThreeViewerProps {
  file: File;
  onLoadComplete?: () => void;
  onLoadError?: (error: unknown) => void;
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

function SceneModel({ group, wireframe, color }: SceneModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Apply material overrides in-place when color / wireframe changes.
  // We traverse on every render because the children are raw Three objects
  // and R3F won't re-render them for prop changes.
  useLayoutEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (mat) {
          mat.color.set(color);
          mat.wireframe = wireframe;
          mat.needsUpdate = true;
        }
      }
    });
  }, [color, wireframe]);

  return <primitive ref={groupRef} object={group} />;
}

// ── ThreeViewer ──────────────────────────────────────────────────────────

export function ThreeViewer({ file, onLoadComplete, onLoadError }: ThreeViewerProps) {
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
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 7]} intensity={1.2} />
        <directionalLight position={[-3, -2, 4]} intensity={0.4} />

        {showViewer && (
          <>
            <SceneModel group={model!} wireframe={wireframe} color={materialColor} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} />

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