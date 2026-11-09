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
  const process = spawn("tar.exe", ["-a", "-c", "-f", output, "-C", staging, "."], { stdio: "inherit" });
  process.on("exit", (code) => code === 0 ? accept() : reject(new Error(`tar exited with ${code}`)));
  process.on("error", reject);
});
console.log(`Created ${output}`);
