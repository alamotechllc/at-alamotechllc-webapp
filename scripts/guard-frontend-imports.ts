import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FRONTEND_ROOTS = ["apps/web"];
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"]);
const FORBIDDEN = [
  "firebase-admin",
  "firebase/firestore",
  "firebase/storage",
  "@raas/store",
  "@raas/auth",
  "@raas/ingress",
  "@raas/api",
  "@raas/secrets",
  "@raas/ghl-adapter",
];

export function findForbiddenImports(text: string): string[] {
  return FORBIDDEN.filter((name) => text.includes(name));
}

export function scanFrontend(root = process.cwd()): string[] {
  const hits: string[] = [];
  for (const rel of FRONTEND_ROOTS) {
    const dir = path.join(root, rel);
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      const found = findForbiddenImports(text);
      if (found.length > 0) hits.push(`${path.relative(root, file)}: ${found.join(", ")}`);
    }
  }
  return hits;
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (SOURCE_EXT.has(path.extname(entry))) files.push(full);
  }
  return files;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  const hits = scanFrontend();
  if (hits.length > 0) {
    console.error(hits.join("\n"));
    process.exit(1);
  }
}
