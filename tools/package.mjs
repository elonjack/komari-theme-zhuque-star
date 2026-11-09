import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(root, "komari-theme.json"), "utf8"));
const stagingRoot = resolve(root, ".package");
const staging = resolve(stagingRoot, manifest.short);
const output = resolve(root, `komari-zhuque-star-v${manifest.version}.zip`);

await rm(stagingRoot, { recursive: true, force: true });
await rm(output, { force: true });
await mkdir(staging, { recursive: true });
await cp(resolve(root, "dist"), resolve(staging, "dist"), { recursive: true });
await cp(resolve(root, "komari-theme.json"), resolve(staging, "komari-theme.json"));

await new Promise((accept, reject) => {
  // Komari requires the manifest entry name to be exactly
  // `komari-theme.json`. Packing `.` prefixes every entry with `./` and the
  // remote importer then reports that the manifest is missing.
  const process = spawn("tar.exe", ["-a", "-c", "-f", output, "-C", staging, "komari-theme.json", "dist"], { stdio: "inherit" });
  process.on("exit", (code) => code === 0 ? accept() : reject(new Error(`tar exited with ${code}`)));
  process.on("error", reject);
});

const archive = await readFile(output);
let eocd = -1;
for (let index = archive.length - 22; index >= Math.max(0, archive.length - 65557); index -= 1) {
  if (archive.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
}
if (eocd < 0) throw new Error("Package ZIP end record was not found");
const entryCount = archive.readUInt16LE(eocd + 10);
let cursor = archive.readUInt32LE(eocd + 16);
const entries = [];
for (let index = 0; index < entryCount; index += 1) {
  if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Package ZIP central directory is invalid");
  const nameLength = archive.readUInt16LE(cursor + 28);
  const extraLength = archive.readUInt16LE(cursor + 30);
  const commentLength = archive.readUInt16LE(cursor + 32);
  entries.push(archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"));
  cursor += 46 + nameLength + extraLength + commentLength;
}
if (!entries.includes("komari-theme.json")) throw new Error("Package manifest is not at ZIP root");
if (!entries.includes("dist/index.html")) throw new Error("Package is missing dist/index.html");
if (entries.some((entry) => entry.startsWith("./"))) throw new Error("Package contains unsupported ./ entry prefixes");
console.log(`Created ${output}`);
