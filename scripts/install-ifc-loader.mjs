/**
 * Copies the official Three.js IFCLoader (vendored from r149) into three/examples
 * because three@0.184 no longer ships it. Run automatically via postinstall.
 */
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorLoader = join(root, "vendor", "IFCLoader.js");
const targetLoader = join(
  root,
  "node_modules",
  "three",
  "examples",
  "jsm",
  "loaders",
  "IFCLoader.js"
);
const targetIfcDir = join(
  root,
  "node_modules",
  "three",
  "examples",
  "jsm",
  "loaders",
  "ifc"
);

mkdirSync(targetIfcDir, { recursive: true });
copyFileSync(vendorLoader, targetLoader);

// web-ifc-api.js is committed under vendor/ifc for reproducible installs
const vendorApi = join(root, "vendor", "ifc", "web-ifc-api.js");
const targetApi = join(targetIfcDir, "web-ifc-api.js");
copyFileSync(vendorApi, targetApi);

console.log("[postinstall] Installed official IFCLoader into three/examples/jsm/loaders/");
