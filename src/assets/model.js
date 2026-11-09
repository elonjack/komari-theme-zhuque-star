import { clamp, finite, ratio } from "./format.js";

export function normalizeNode(raw = {}, key = "", options = {}) {
  const ram = raw.ram && typeof raw.ram === "object" ? raw.ram : {};
  const disk = raw.disk && typeof raw.disk === "object" ? raw.disk : {};
  const network = raw.network && typeof raw.network === "object" ? raw.network : {};
  const load = raw.load && typeof raw.load === "object" ? raw.load : {};
  const connections = raw.connections && typeof raw.connections === "object" ? raw.connections : {};
  const cpu = typeof raw.cpu === "number" ? raw.cpu : raw.cpu?.usage;
  const node = {
    uuid: String(raw.uuid || raw.id || key),
    name: String(raw.name || raw.display_name || "未命名节点"),
    group: String(raw.group || "朱雀星"),
    region: String(raw.region || raw.location || "未知星域"),
    provider: String(raw.provider || raw.provider_name || raw.vendor || "未提供"),
    weight: finite(raw.weight, 9999),
    online: Boolean(raw.online ?? raw.is_online ?? false),
    cpu: clamp(cpu),
    cpuName: String(raw.cpu_name || raw.cpu_model || raw.cpuName || "未提供"),
    cpuCores: finite(raw.cpu_cores || raw.cpuCores || raw.cores),
    gpuName: String(raw.gpu_name || raw.gpuName || "未提供"),
    ramUsed: finite(raw.ramUsed ?? raw.ram_used ?? (typeof raw.ram === "number" ? raw.ram : ram.used)),
    ramTotal: finite(raw.ramTotal ?? raw.ram_total ?? ram.total ?? raw.mem_total),
    swapUsed: finite(raw.swapUsed ?? raw.swap_used ?? raw.swap?.used),
    swapTotal: finite(raw.swapTotal ?? raw.swap_total ?? raw.swap?.total),
    diskUsed: finite(raw.diskUsed ?? raw.disk_used ?? (typeof raw.disk === "number" ? raw.disk : disk.used)),
    diskTotal: finite(raw.diskTotal ?? raw.disk_total ?? disk.total),
    netUp: finite(raw.netUp ?? raw.network_up ?? raw.net_out ?? network.up),
    netDown: finite(raw.netDown ?? raw.network_down ?? raw.net_in ?? network.down),
    totalUp: finite(raw.totalUp ?? raw.net_total_up ?? network.totalUp ?? network.total_up),
    totalDown: finite(raw.totalDown ?? raw.net_total_down ?? network.totalDown ?? network.total_down),
    trafficLimit: finite(raw.trafficLimit ?? raw.traffic_limit),
    trafficLimitType: String(raw.trafficLimitType ?? raw.traffic_limit_type ?? "sum").toLowerCase(),
    uptime: finite(raw.uptime),
    load1: finite(raw.load1 ?? (typeof raw.load === "number" ? raw.load : load.load1)),
    load5: finite(raw.load5 ?? load.load5),
    load15: finite(raw.load15 ?? load.load15),
    temperature: Number.isFinite(Number(raw.temp ?? raw.temperature)) ? Number(raw.temp ?? raw.temperature) : null,
    processes: finite(raw.process ?? raw.processes),
    tcp: finite(raw.tcp ?? (typeof raw.connections === "number" ? raw.connections : connections.tcp)),
    udp: finite(raw.udp ?? raw.connections_udp ?? connections.udp),
    os: String(raw.os || raw.os_name || "未提供"),
    kernelVersion: String(raw.kernel_version || raw.kernelVersion || "未提供"),
    arch: String(raw.arch || "未提供"),
    virtualization: String(raw.virtualization || "未提供"),
    price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : null,
    billingCycle: raw.billingCycle ?? raw.billing_cycle ?? null,
    currency: String(raw.currency || "¥"),
    expiredAt: raw.expiredAt ?? raw.expired_at ?? null,
    autoRenewal: Boolean(raw.autoRenewal ?? raw.auto_renewal),
    publicRemark: String(raw.public_remark || raw.publicRemark || ""),
    tags: String(raw.tags || ""),
    updatedAt: raw.updated_at ?? raw.updatedAt ?? null,
  };
  if (options.includeSensitive) {
    node.ipv4 = String(raw.ipv4 || "");
    node.ipv6 = String(raw.ipv6 || "");
  }
  return node;
}

export function normalizeNodes(payload, options = {}) {
  const candidate = payload?.data?.data ?? payload?.data ?? payload?.result ?? payload;
  const raw = candidate?.clients ?? candidate;
  if (Array.isArray(raw)) return raw.map((node) => normalizeNode(node, "", options));
  if (raw && typeof raw === "object") return Object.entries(raw).map(([key, node]) => normalizeNode(node, key, options));
  return [];
}

export function mergeStatus(node, status = {}) {
  return normalizeNode({ ...node, ...status, uuid: node.uuid, name: node.name, group: node.group, region: node.region, provider: node.provider,
    ramTotal: status.ram?.total ?? status.ram_total ?? node.ramTotal,
    ramUsed: status.ram?.used ?? status.ram_used ?? (typeof status.ram === "number" ? status.ram : node.ramUsed),
    diskTotal: status.disk?.total ?? status.disk_total ?? node.diskTotal,
    diskUsed: status.disk?.used ?? status.disk_used ?? (typeof status.disk === "number" ? status.disk : node.diskUsed),
    netUp: status.network?.up ?? status.net_out ?? node.netUp,
    netDown: status.network?.down ?? status.net_in ?? node.netDown,
    totalUp: status.network?.totalUp ?? status.network?.total_up ?? status.net_total_up ?? node.totalUp,
    totalDown: status.network?.totalDown ?? status.network?.total_down ?? status.net_total_down ?? node.totalDown,
  }, "", { includeSensitive: "ipv4" in node || "ipv6" in node });
}

export function nodeHealth(node) {
  if (!node.online) return { key: "offline", label: "星魂黯灭", plain: "离线" };
  const ram = ratio(node.ramUsed, node.ramTotal);
  const disk = ratio(node.diskUsed, node.diskTotal);
  if (node.cpu >= 90 || ram >= 95 || disk >= 95) return { key: "critical", label: "灵力逆乱", plain: "严重" };
  if (node.cpu >= 70 || ram >= 80 || disk >= 85) return { key: "warning", label: "气机波动", plain: "注意" };
  return { key: "healthy", label: "星魂稳定", plain: "正常" };
}

export function groupNodes(nodes) {
  const map = new Map();
  [...nodes].sort((a, b) => a.weight - b.weight || a.name.localeCompare(b.name, "zh-CN")).forEach((node) => {
    if (!map.has(node.group)) map.set(node.group, []);
    map.get(node.group).push(node);
  });
  return [...map.entries()].map(([name, items]) => ({ name, nodes: items }));
}
