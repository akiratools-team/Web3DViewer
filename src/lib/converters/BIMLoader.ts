import * as THREE from "three";

/** dotBIM color — RGBA bytes 0–255 */
interface DotBimColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface DotBimVector {
  x: number;
  y: number;
  z: number;
}

interface DotBimRotation {
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

interface DotBimMesh {
  mesh_id: number | string;
  coordinates: number[];
  indices?: number[];
  colors?: number[];
}

interface DotBimElement {
  mesh_id: number | string;
  vector?: DotBimVector;
  rotation?: DotBimRotation;
  guid?: string;
  type?: string;
  color?: DotBimColor | null;
  face_colors?: number[];
  info?: Record<string, string>;
}

interface DotBimFile {
  schema_version?: string;
  meshes: DotBimMesh[];
  elements: DotBimElement[];
  /** Web3DViewer export — global flat xyz vertex pool */
  coordinates?: number[];
  info?: Record<string, string>;
  file_info?: Record<string, string>;
}

function colorFromBytes(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function alphaFromByte(a: number): number {
  return a / 255;
}

function isTransparentColor(color: DotBimColor | null | undefined): boolean {
  if (!color) return true;
  return color.r === 0 && color.g === 0 && color.b === 0 && color.a === 0;
}

function createFaceColors(
  color4Array: number[],
  repeat = 3,
  max = 0
): number[] {
  const colors: number[] = [];
  for (let i = 0; i < color4Array.length; i += 4) {
    const c = colorFromBytes(
      color4Array[i],
      color4Array[i + 1],
      color4Array[i + 2]
    );
    const a = alphaFromByte(color4Array[i + 3]);
    for (let j = 0; j < repeat; j++) {
      colors.push(c.r, c.g, c.b, a);
    }
  }
  while (colors.length < max) {
    colors.push(colors[0], colors[1], colors[2], colors[3]);
  }
  return colors;
}

/** Web3DViewer export stores vertex indices in `coordinates` + a top-level xyz pool. */
function isWebViewerExport(data: DotBimFile): boolean {
  return Array.isArray(data.coordinates) && data.coordinates.length > 0;
}

function geometryFromWebViewerMesh(
  mesh: DotBimMesh,
  globalCoords: number[]
): THREE.BufferGeometry {
  const indexRefs = mesh.indices ?? mesh.coordinates;
  const positions = new Float32Array(indexRefs.length * 3);

  for (let i = 0; i < indexRefs.length; i++) {
    const gi = indexRefs[i];
    positions[i * 3] = globalCoords[gi * 3];
    positions[i * 3 + 1] = globalCoords[gi * 3 + 1];
    positions[i * 3 + 2] = globalCoords[gi * 3 + 2];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function geometryFromOfficialMesh(mesh: DotBimMesh): THREE.BufferGeometry {
  const { coordinates, indices, colors } = mesh;

  if (!coordinates?.length) {
    throw new Error(`Mesh "${mesh.mesh_id}" has no coordinates.`);
  }

  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(coordinates, 3)
  );

  if (indices?.length) {
    geometry.setIndex(indices);
    geometry = geometry.toNonIndexed();
  }

  if (colors?.length) {
    const faceColors = createFaceColors(
      colors,
      3,
      4 * (indices?.length ?? coordinates.length / 3)
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(faceColors, 4)
    );
  }

  geometry.computeVertexNormals();
  return geometry;
}

function buildGeometryMap(data: DotBimFile): Map<string, THREE.BufferGeometry> {
  const map = new Map<string, THREE.BufferGeometry>();
  const webExport = isWebViewerExport(data);
  const globalCoords = data.coordinates ?? [];

  for (const mesh of data.meshes) {
    const key = String(mesh.mesh_id);
    const geometry = webExport
      ? geometryFromWebViewerMesh(mesh, globalCoords)
      : geometryFromOfficialMesh(mesh);
    map.set(key, geometry);
  }

  return map;
}

function elementToMesh(
  element: DotBimElement,
  geometries: Map<string, THREE.BufferGeometry>
): THREE.Mesh | null {
  const key = String(element.mesh_id);
  const baseGeometry = geometries.get(key);
  if (!baseGeometry) return null;

  let geometry = baseGeometry;
  let color = element.color;
  if (isTransparentColor(color)) color = undefined;

  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    metalness: 0.1,
    roughness: 0.75,
    color: 0x9696c8,
  });

  if (element.face_colors?.length) {
    geometry = baseGeometry.clone();
    const colors = createFaceColors(element.face_colors);
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 4)
    );
    material.vertexColors = true;
    material.transparent = true;
    material.opacity = 1;
  } else if (color) {
    geometry = baseGeometry.clone();
    geometry.deleteAttribute("color");
    material.color = colorFromBytes(color.r, color.g, color.b);
    material.opacity = alphaFromByte(color.a);
    material.transparent = material.opacity < 1;
  } else if (geometry.getAttribute("color")) {
    material.vertexColors = true;
    material.transparent = true;
    material.opacity = 1;
  }

  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);

  const vector = element.vector ?? { x: 0, y: 0, z: 0 };
  const rotation = element.rotation ?? { qx: 0, qy: 0, qz: 0, qw: 1 };
  mesh.position.set(vector.x, vector.y, vector.z);
  mesh.quaternion.set(rotation.qx, rotation.qy, rotation.qz, rotation.qw);

  if (element.type) mesh.userData.type = element.type;
  if (element.guid) mesh.userData.guid = element.guid;
  if (element.info) mesh.userData.info = element.info;

  return mesh;
}

/**
 * dotBIM (.bim) Loader — parses official dotbim JSON and Web3DViewer exports.
 * https://dotbim.io/
 */
export class BIMLoader {
  parse(text: string): THREE.Group {
    let data: DotBimFile;
    try {
      data = JSON.parse(text) as DotBimFile;
    } catch {
      throw new Error("Failed to parse BIM file — invalid JSON.");
    }

    if (!data.meshes?.length || !data.elements?.length) {
      throw new Error("BIM file contains no meshes or elements.");
    }

    const geometries = buildGeometryMap(data);
    const group = new THREE.Group();
    group.name = data.file_info?.file_name ?? data.info?.Name ?? "dotBIM";

    for (const element of data.elements) {
      const mesh = elementToMesh(element, geometries);
      if (mesh) group.add(mesh);
    }

    if (group.children.length === 0) {
      throw new Error("BIM file has no renderable elements.");
    }

    return group;
  }
}

export async function loadBIMFile(file: File): Promise<THREE.Group> {
  const text = await file.text();
  return new BIMLoader().parse(text);
}
