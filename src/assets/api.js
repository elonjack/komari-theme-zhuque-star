function unwrap(payload) { return payload?.data?.data ?? payload?.data ?? payload?.result ?? payload; }

export async function rpc(method, params = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("/api/rpc2", { method: "POST", credentials: "same-origin", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID?.() || `${Date.now()}`, method, params }) });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || `RPC ${method} failed`);
    return body.result;
  } finally { clearTimeout(timer); }
}

async function rest(path) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  return unwrap(await response.json());
}

async function rawJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 16000);
  try {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

export function adoptTemporaryAccessKey() {
  const url = new URL(location.href);
  const key = url.searchParams.get("temp_key");
  if (!key) return;
  const value = /^[A-Za-z0-9._~-]+$/.test(key) ? key : encodeURIComponent(key);
  document.cookie = `temp_key=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  url.searchParams.delete("temp_key");
  history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function loadPublicData() {
  const settled = await Promise.allSettled([rpc("public:getPublicSettings"), rpc("public:getNodesInformation").catch(() => rpc("common:getNodes")), rpc("public:getPublicPingTasks")]);
  const values = settled.map((item) => item.status === "fulfilled" ? item.value : null);
  const fallback = await Promise.allSettled([
    values[0] || rest("/api/public"), values[1] || rest("/api/nodes"), values[2] || rest("/api/task/ping"),
  ]);
  return {
    publicInfo: fallback[0].status === "fulfilled" ? unwrap(fallback[0].value) : {},
    nodes: fallback[1].status === "fulfilled" ? fallback[1].value : [],
    tasks: fallback[2].status === "fulfilled" ? fallback[2].value : [],
  };
}

export const loadLatestStatus = () => rpc("common:getNodesLatestStatus");
export const loadPingStats = (uuids, taskIds) => rpc("public:getPingMetricStats", { entity_ids: uuids, task_ids: taskIds, hours: 4, max_points: 120 });
export async function loadPingHistory(uuid, hours = 24) {
  try {
    return await rpc("common:getRecords", { uuid, hours, type: "ping", maxCount: Math.max(240, hours * 120) });
  } catch {
    return rest(`/api/records/ping?${new URLSearchParams({ uuid, hours: String(hours) })}`);
  }
}
export const loadHistory = (uuid, hours = 24) => rpc("public:queryMetrics", { entity_id: uuid, hours, max_points: 160, downsample: true, fill_empty: true,
  metric_keys: ["cpu.usage", "memory.used", "memory.total", "swap.used", "swap.total", "disk.used", "disk.total", "load.average", "net.in.rate", "net.out.rate", "net.total.up", "net.total.down", "temperature", "process.count", "connections.tcp", "connections.udp"] });
export const loadIpPluginStatus = () => rawJson("/api/public/ip-info/v1/status");
export const loadIpInfo = (uuid, ip) => rawJson(`/api/public/ip-info/v1/lookup?${new URLSearchParams({ uuid, ip })}`);
export const loadIpLatency = (uuid, ip) => rawJson(`/api/public/ip-info/v1/latency?${new URLSearchParams({ uuid, ip })}`);

export function openRealtime(onMessage, onState) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${location.host}/api/clients`);
  socket.addEventListener("open", () => { onState("connected"); socket.send("get"); socket.poll = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send("get"), 1000); });
  socket.addEventListener("message", (event) => { try { onMessage(JSON.parse(event.data)); } catch {} });
  socket.addEventListener("close", () => { clearInterval(socket.poll); onState("reconnecting"); });
  socket.addEventListener("error", () => socket.close());
  return socket;
}
