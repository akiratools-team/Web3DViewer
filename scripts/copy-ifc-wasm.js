/**
 * Copies official web-ifc WASM binaries from node_modules into public/web-ifc/
 * so IFCLoader can fetch them at runtime via loader.setWasmPath('/web-ifc/').
 *
 * Run after installing web-ifc: npm run setup-ifc
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "node_modules", "web-ifc");
const TARGET_DIR = path.join(ROOT, "public", "web-ifc");

const WASM_FILES = ["web-ifc.wasm", "web-ifc-mt.wasm"];

function copyIfcWasm() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(
      "[setup-ifc] node_modules/web-ifc not found. Run: npm install web-ifc"
    );
    process.exit(1);
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });

  for (const file of WASM_FILES) {
    const source = path.join(SOURCE_DIR, file);
    const target = path.join(TARGET_DIR, file);

    if (!fs.existsSync(source)) {
      console.error(`[setup-ifc] Missing source file: ${source}`);
      process.exit(1);
    }

    fs.copyFileSync(source, target);
    console.log(`[setup-ifc] Copied ${file} → public/web-ifc/${file}`);
  }

  console.log("[setup-ifc] IFC WASM setup complete.");
}

copyIfcWasm();
