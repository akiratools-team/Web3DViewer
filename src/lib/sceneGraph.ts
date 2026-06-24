import * as THREE from "three";

export type SceneGraphNodeType = "Mesh" | "Group";

export interface SceneGraphNode {
  id: string;
  name: string;
  type: SceneGraphNodeType;
  children?: SceneGraphNode[];
}

/**
 * Builds a lightweight hierarchical tree of Mesh and Group nodes
 * from a loaded Three.js object hierarchy.
 */
export function extractSceneGraph(root: THREE.Object3D): SceneGraphNode[] {
  let meshCounter = 0;
  let groupCounter = 0;

  function toNode(object: THREE.Object3D): SceneGraphNode | null {
    const childNodes = object.children
      .map((child) => toNode(child))
      .filter((node): node is SceneGraphNode => node !== null);

    if (object instanceof THREE.Mesh) {
      return {
        id: object.uuid,
        name: object.name.trim() || `Mesh ${++meshCounter}`,
        type: "Mesh",
        ...(childNodes.length > 0 ? { children: childNodes } : {}),
      };
    }

    if (object instanceof THREE.Group) {
      return {
        id: object.uuid,
        name: object.name.trim() || `Group ${++groupCounter}`,
        type: "Group",
        ...(childNodes.length > 0 ? { children: childNodes } : {}),
      };
    }

    if (childNodes.length === 1) return childNodes[0];

    if (childNodes.length > 1) {
      return {
        id: object.uuid,
        name: object.name.trim() || `Group ${++groupCounter}`,
        type: "Group",
        children: childNodes,
      };
    }

    return null;
  }

  const tree = toNode(root);
  return tree ? [tree] : [];
}
