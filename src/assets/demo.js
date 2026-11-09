const GB = 1024 ** 3;
const TB = 1024 ** 4;

export const demoPublicInfo = {
  sitename: "朱雀星 · Komari",
  theme_settings: {
    atlas_title: "朱雀星", lore_mode: true, show_billing: true, show_provider: true, show_character: true,
    motion_enabled: true, motion_strength: "标准", star_density: "标准", font_style: "颜楷风", show_network_identity: true,
    country_sects: "HK=炼魂宗;SG=云天宗;JP=战神殿;DE=大罗剑宗;FI=雨之仙界",
    group_aliases: "香港星域=赵国;日本星域=火焚国;欧洲星域=修魔海",
  },
};

export const demoNodes = [
  node("zhao-hk-01", "恒岳派", "香港星域", "🇭🇰 香港", "LightNode", true, 24, 3.2, 8, 41, 18, 7, 1.26, 86, "$", 365, 46),
  node("zhao-sg-02", "云天宗", "香港星域", "🇸🇬 新加坡", "Vultr", true, 58, 5.9, 8, 63, 42, 16, 2.8, 144, "$", 365, 23),
  node("fire-jp-01", "战神殿", "日本星域", "🇯🇵 东京", "GreenCloud", true, 76, 11.6, 16, 72, 81, 28, 5.2, 99, "$", 365, 12),
  node("fire-jp-02", "炼魂宗", "日本星域", "🇯🇵 大阪", "HostHatch", false, 0, 0, 8, 48, 0, 0, 1.6, 72, "$", 365, -3),
  node("sea-de-01", "古神之地", "欧洲星域", "🇩🇪 法兰克福", "Hetzner", true, 37, 18.2, 32, 53, 125, 38, 8.9, 45, "€", 30, 72),
  node("sea-fi-02", "雨之仙界", "欧洲星域", "🇫🇮 赫尔辛基", "Hetzner", true, 12, 6.4, 16, 29, 19, 12, 3.4, 28, "€", 30, 138),
];

function node(uuid, name, group, region, provider, online, cpu, ramGB, ramTotalGB, diskPercent, downMB, upMB, trafficTB, price, currency, billingCycle, expiryDays) {
  const ipSeed = [...uuid].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 190 + 20;
  return {
    uuid, name, group, region, provider, online, cpu, cpu_name: "AMD EPYC 7B13", cpu_cores: ramTotalGB >= 16 ? 8 : 4,
    ram_used: ramGB * GB, ram_total: ramTotalGB * GB, disk_used: diskPercent / 100 * 160 * GB, disk_total: 160 * GB,
    net_in: downMB * 1024 ** 2, net_out: upMB * 1024 ** 2, net_total_down: trafficTB * TB * .62, net_total_up: trafficTB * TB * .38,
    traffic_limit: 12 * TB, uptime: online ? 37 * 86400 + 18340 : 0, load1: cpu / 34, load5: cpu / 41, load15: cpu / 48,
    swap_used: online ? ramGB * .08 * GB : 0, swap_total: 2 * GB,
    temperature: online ? 39 + cpu * .22 : null, processes: online ? 96 + Math.round(cpu) : 0, tcp: online ? 120 + Math.round(cpu * 2) : 0, udp: online ? 18 : 0,
    os: "Debian 13", kernel_version: "6.12.38", arch: "x86_64", virtualization: "KVM", gpu_name: "无独立 GPU", tags: "SSD, BGP", price, currency, billing_cycle: billingCycle, traffic_limit_type: "sum", updated_at: new Date().toISOString(),
    expired_at: new Date(Date.now() + expiryDays * 86400000).toISOString(), auto_renewal: expiryDays > 0,
    ipv4: `203.0.113.${ipSeed}`, ipv6: `2001:db8::${ipSeed.toString(16)}`,
    public_remark: name === "战神殿" ? "主力中转，晚高峰重点观测" : "",
  };
}

export const demoTasks = [
  { id: 1, name: "上海移动", default_on: true },
  { id: 2, name: "广州联通", default_on: true },
  { id: 3, name: "北京电信", default_on: true },
];

export function demoPing(node, task) {
  if (!node.online) return { latest: null, avg: null, loss: 100 };
  const seed = [...node.uuid, ...String(task.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = 18 + seed % 92;
  return { latest: base + seed % 9, avg: base, loss: node.cpu > 70 && task.id === 1 ? 2.4 : 0, p99: base * 1.7 };
}

export function demoPingHistory(node, task, count = 80) {
  if (!node.online) return Array(count).fill(null);
  const stat = demoPing(node, task), seed = [...node.uuid, ...String(task.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: count }, (_, index) => Math.max(1, stat.avg + Math.sin((index + seed) * .31) * 7 + Math.cos((index + seed) * .83) * 3));
}

export function demoHistory(node, count = 80) {
  const seed = [...node.uuid].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const wave = (base, spread, offset) => Array.from({ length: count }, (_, index) => Math.max(0, base + Math.sin((index + seed + offset) * .29) * spread + Math.cos((index + seed) * .83) * spread * .35));
  const down = wave(node.netDown / 1024 ** 2, Math.max(3, node.netDown / 1024 ** 2 * .35), 23), up = wave(node.netUp / 1024 ** 2, Math.max(2, node.netUp / 1024 ** 2 * .3), 31);
  return { cpu: wave(node.cpu, 9, 0), ram: wave(node.ramUsed / node.ramTotal * 100, 4, 11), swap: wave(node.swapUsed / node.swapTotal * 100, 2, 15), disk: wave(node.diskUsed / node.diskTotal * 100, .5, 17), load: wave(node.load1, .45, 8), temperature: wave(node.temperature || 0, 3, 19), process: wave(node.processes, 12, 4), tcp: wave(node.tcp, 18, 6), udp: wave(node.udp, 4, 10), down, up,
    totalDown: down.map((_,i)=>node.totalDown - (down.length-i)*1.8*GB), totalUp: up.map((_,i)=>node.totalUp - (up.length-i)*.7*GB) };
}
