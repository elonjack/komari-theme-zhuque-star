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
