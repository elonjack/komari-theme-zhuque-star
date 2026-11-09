import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeNode, nodeHealth } from "../src/assets/model.js";
import { countryIdentity, formatBytes, parseAliases, ratio } from "../src/assets/format.js";

test("normalization drops sensitive address and credential fields", () => {
  const node = normalizeNode({ uuid: "safe", name: "Test", ipv4: "203.0.113.1", ipv6: "2001:db8::1", token: "secret", remark: "private" });
  for (const key of ["ipv4", "ipv6", "token", "remark"]) assert.equal(key in node, false);
});

test("health states remain based on standard metrics", () => {
  assert.equal(nodeHealth(normalizeNode({ online: false })).key, "offline");
  assert.equal(nodeHealth(normalizeNode({ online: true, cpu: 94 })).key, "critical");
  assert.equal(nodeHealth(normalizeNode({ online: true, cpu: 42, ram_used: 40, ram_total: 100 })).key, "healthy");
});

test("format helpers preserve real units and alias mappings", () => {
  assert.equal(ratio(40, 80), 50);
  assert.match(formatBytes(1024 ** 3), /1\.00 GB/);
  assert.equal(parseAliases("香港=赵国;日本=火焚国").get("日本"), "火焚国");
});

test("country identity accepts flags, ISO codes, English and Chinese regions", () => {
  assert.deepEqual(countryIdentity("🇫🇮 FI · Helsinki"), { code: "FI", flag: "🇫🇮", name: "芬兰", raw: "🇫🇮 FI · Helsinki" });
  assert.equal(countryIdentity("Hong Kong").flag, "🇭🇰");
  assert.equal(countryIdentity("香港").code, "HK");
  assert.equal(countryIdentity("US - Los Angeles").name, "美国");
  assert.equal(countryIdentity("月球基地").flag, "🌐");
});

test("built theme preserves Komari markers and has no external runtime assets", async () => {
  const html = await readFile("dist/index.html", "utf8");
  const css = await readFile("dist/assets/zhuque.css", "utf8");
  const main = await readFile("dist/assets/main.js", "utf8");
  assert.match(html, /<title>Komari Monitor<\/title>/);
  assert.match(html, /A simple server monitor tool\./);
  assert.doesNotMatch(html + css, /https?:\/\//i);
  assert.match(main, /renderHome/);
  assert.match(main, /renderDetail/);
  assert.match(main, /renderTraffic/);
  assert.match(main, /renderAssets/);
});

test("node overview is a continuous ledger rather than card components", async () => {
  const main = await readFile("src/assets/main.js", "utf8");
  const css = await readFile("src/assets/zhuque.css", "utf8");
  assert.match(main, /stellar-ledger/);
  assert.match(main, /star-line/);
  assert.doesNotMatch(main, /node-card|metric-card|dashboard-card/);
  assert.match(css, /\.star-line\{/);
  assert.match(main, /sect-backdrop/);
  assert.match(main, /sect-thumbnail/);
  assert.match(css, /zhuque-hero-v2\.png/);
  assert.match(css, /sect-hengyue-v2\.png/);
  assert.match(css, /sect-lianhun-v2\.png/);
  assert.match(css, /realm-ancient-god-v2\.png/);
  assert.match(main, /country-mark/);
  assert.match(css, /wanglin-whitehair-v3\.png/);
});

test("frost realm release includes local motion, a rotating country-sect globe and accessible fallback", async () => {
  const main = await readFile("src/assets/main.js", "utf8");
  const css = await readFile("src/assets/zhuque.css", "utf8");
  const motion = await readFile("src/assets/hero-motion.js", "utf8");
  const manifest = JSON.parse(await readFile("komari-theme.json", "utf8"));
  assert.equal(manifest.version, "0.7.2");
  assert.equal(manifest.url, "https://github.com/elonjack/komari-theme-zhuque-star");
  assert.match(main, /renderSectGlobe/);
  assert.match(main, /countrySects/);
  assert.match(main, /data-country/);
  assert.match(css, /wanglin-original-4k-v3\.png/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(motion, /IntersectionObserver/);
  assert.doesNotMatch(motion, /https?:\/\//i);
});

test("globe uses real coordinates, pauses offscreen and keeps fonts local", async () => {
  const main = await readFile("src/assets/main.js", "utf8");
  const css = await readFile("src/assets/zhuque.css", "utf8");
  const globe = await readFile("src/assets/sect-globe.js", "utf8");
  assert.match(main, /GEO_COORDS/);
  assert.match(main, /data-lat/);
  assert.match(globe, /IntersectionObserver/);
  assert.match(globe, /prefers-reduced-motion/);
  assert.match(globe, /earth-blue-marble-2048\.jpg/);
  assert.match(globe, /u_night/);
  assert.match(globe, /u_water/);
  assert.match(globe, /Fresnel|fresnel/);
  assert.match(globe, /canMipmap/);
  assert.match(css, /font-yan/);
  assert.match(css, /STKaiti/);
  assert.doesNotMatch(globe + css, /@import\s+url|fonts\.googleapis|https?:\/\//i);
});

test("v0.7 gives core sects distinct realms, brighter orthodox styling and layered wind", async () => {
  const main = await readFile("src/assets/main.js", "utf8");
  const css = await readFile("src/assets/zhuque.css", "utf8");
  const motion = await readFile("src/assets/hero-motion.js", "utf8");
  for (const slug of ["sect-hengyue", "sect-daluo", "sect-rain", "sect-soul", "sect-war", "sect-cloud"]) assert.match(main + css, new RegExp(slug));
  assert.match(main, /万剑朝宗/);
  assert.match(main, /data-wind/);
  assert.match(css, /tone-light/);
  assert.match(css, /sect-daluo-v1\.jpg/);
  assert.match(motion, /tipFreedom/);
  assert.match(motion, /motionTarget/);
});

test("v0.7.1 globe uses flag-only country markers without a decorative sigil", async () => {
  const main = await readFile("src/assets/main.js", "utf8");
  const css = await readFile("src/assets/zhuque.css", "utf8");
  assert.doesNotMatch(main + css, /globe-sigil|globe-node-pulse/);
  assert.match(main, /aria-label="筛选/);
  assert.match(css, /\.globe-node>\.flag-icon/);
});

test("telemetry parity includes swap, GPU, kernel, quota modes and opt-in network identity", async () => {
  const main = await readFile("src/assets/main.js", "utf8");
  const model = await readFile("src/assets/model.js", "utf8");
  const api = await readFile("src/assets/api.js", "utf8");
  assert.match(model, /gpuName/);
  assert.match(model, /kernelVersion/);
  assert.match(model, /trafficLimitType/);
  assert.match(main, /今日流量/);
  assert.match(main, /P50/);
  assert.match(main, /Ping 历史趋势/);
  assert.match(main, /进程与连接历史趋势/);
  assert.match(main, /网络身份与全球延迟/);
  assert.match(api, /ip-info\/v1\/lookup/);
  const safe = normalizeNode({ uuid: "safe", ipv4: "203.0.113.1", ipv6: "2001:db8::1" });
  assert.equal("ipv4" in safe, false);
  const optedIn = normalizeNode({ uuid: "shown", ipv4: "203.0.113.2" }, "", { includeSensitive: true });
  assert.equal(optedIn.ipv4, "203.0.113.2");
});
