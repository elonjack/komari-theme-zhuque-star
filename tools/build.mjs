import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src");
const output = resolve(root, "dist");
const version = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version;

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

// Keep original and retired artwork in source control for future redesigns,
// but never ship it in the Komari runtime bundle. Remote theme import is a
// synchronous download, so dead multi-megabyte images can trigger proxy 504s.
const runtimeImages = new Set([
  "wanglin-original-4k-v3.jpg",
  "realm-ancient-god-v2.jpg",
  "earth-blue-marble-2048.jpg",
  "earth-night.jpg",
  "earth-topology.png",
  "earth-water.png",
  "sect-hengyue-v3.jpg",
  "sect-daluo-v1.jpg",
  "sect-rain-immortal-v1.jpg",
  "sect-soul-refining-v3.jpg",
  "sect-war-god-v1.jpg",
  "sect-cloud-heaven-v1.jpg",
]);
const outputImages = resolve(output, "assets", "images");
for (const entry of await readdir(outputImages, { withFileTypes: true })) {
  if (entry.isFile() && !runtimeImages.has(entry.name)) await rm(resolve(outputImages, entry.name));
}

async function versionImports(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await versionImports(path);
    else if (entry.name.endsWith(".js")) {
      const text = await readFile(path, "utf8");
      await writeFile(path, text.replace(/(from\s+["']|import\s*\(\s*["'])(\.{1,2}\/[^"']+\.js)(["'])/g, `$1$2?v=${version}$3`));
    }
  }
}
await versionImports(resolve(output, "assets"));

const html = await readFile(resolve(output, "index.html"), "utf8");
for (const marker of ["<title>Komari Monitor</title>", "A simple server monitor tool.", "</head>", "</body>"]) {
  if (!html.includes(marker)) throw new Error(`Missing Komari template marker: ${marker}`);
}
console.log(`Built Zhuque Star v${version} into ${output}`);
