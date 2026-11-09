import { adoptTemporaryAccessKey, loadHistory, loadIpInfo, loadIpLatency, loadIpPluginStatus, loadLatestStatus, loadPingHistory, loadPingStats, loadPublicData, openRealtime } from "./api.js";
import { demoHistory, demoNodes, demoPing, demoPingHistory, demoPublicInfo, demoTasks } from "./demo.js";
import { lineChart } from "./charts.js";
import { countryIdentity, escapeHtml, expiryDays, formatBytes, formatDate, formatDuration, money, parseAliases, ratio, trafficUsage } from "./format.js";
import { mergeStatus, nodeHealth, normalizeNodes } from "./model.js";
import { mountHeroMotion } from "./hero-motion.js";
import { mountSectGlobe } from "./sect-globe.js";

const app = document.querySelector("#app");
const state = {
  publicInfo: { sitename: "Komari", theme_settings: {} }, nodes: [], tasks: [], pings: new Map(), histories: new Map(), pingHistories: new Map(),
  connection: "loading", error: "", mock: false, search: "", status: "all", sort: "weight", country: "", socket: null, timer: null, ipProfiles: new Map(),
};

let disposeHeroMotion = () => {};
let disposeSectGlobe = () => {};

const DEFAULT_SECTS = {
  CN: "恒岳派", HK: "炼魂宗", SG: "云天宗", JP: "战神殿", DE: "大罗剑宗", FI: "雨之仙界",
  US: "天道宗", TW: "尸阴宗", KR: "巨魔族", GB: "四圣宗", FR: "落日宗", NL: "玄道宗",
  CA: "寒天宗", AU: "归元宗", RU: "雪域宗", IN: "天运宗", VN: "青龙宗", TH: "玄灵宗", "--": "星外散修",
};

const GEO_COORDS = {
  CN: [35.8617, 104.1954], HK: [22.3193, 114.1694], SG: [1.3521, 103.8198], JP: [36.2048, 138.2529],
  DE: [51.1657, 10.4515], FI: [61.9241, 25.7482], US: [37.0902, -95.7129], TW: [23.6978, 120.9605],
  KR: [35.9078, 127.7669], GB: [55.3781, -3.436], FR: [46.2276, 2.2137], NL: [52.1326, 5.2913],
  CA: [56.1304, -106.3468], AU: [-25.2744, 133.7751], RU: [61.524, 105.3188], IN: [20.5937, 78.9629],
  VN: [14.0583, 108.2772], TH: [15.87, 100.9925], "--": [0, 0],
};

const SECT_VISUALS = [
  { match: /恒岳/, slug: "sect-hengyue", tone: "light", icon: "mountain", verse: "群峰列阵 · 一剑问心" },
  { match: /大罗.*剑|剑宗|剑阁|剑门/, slug: "sect-daluo", tone: "light", icon: "sword", verse: "万剑朝宗 · 剑意凌霄" },
  { match: /雨之仙界|雨仙|雨宗/, slug: "sect-rain", tone: "light", icon: "rain", verse: "雨幕通天 · 仙宫照水" },
  { match: /炼魂|魂宗|尸阴|魔宗|修魔|血宗/, slug: "sect-soul", tone: "dark", icon: "soul", verse: "魂灯不灭 · 幽火照渊" },
  { match: /战神|战殿|武神/, slug: "sect-war", tone: "light", icon: "war", verse: "战鼓惊云 · 武魂镇殿" },
  { match: /云天|云宗|天云/, slug: "sect-cloud", tone: "light", icon: "cloud", verse: "云桥万里 · 天门问道" },
];

function sectVisual(name = "", alias = "") {
  const label = `${name} ${alias}`;
  const known = SECT_VISUALS.find((item) => item.match.test(label));
  if (known) return known;
  if (/古神|遗迹|废墟|星骸/i.test(label)) return { slug: "sect-ancient", tone: "dark", icon: "ancient", verse: "星骸无声 · 古意长存" };
  if (/火|炎|焚|赤/i.test(label)) return { slug: "sect-war", tone: "light", icon: "war", verse: "赤霞照殿 · 道火长明" };
  return { slug: "sect-hengyue", tone: "light", icon: "seal", verse: "山门有序 · 道脉长存" };
}

function sectIcon(name, label = "宗门印记") {
  const common = `viewBox="0 0 48 48" role="img" aria-label="${escapeHtml(label)}"`;
  const paths = {
    sword: `<path d="M27 5l7 7-5 4-11 19-5-5 19-11 4-5-9-9Z"/><path d="M10 38l8-8m-4 12-4-4 4-4 4 4-4 4Z"/>`,
    rain: `<path d="M24 5c7 9 12 15 12 23a12 12 0 0 1-24 0C12 20 17 14 24 5Z"/><path d="M18 29c2 4 5 6 9 6"/>`,
    soul: `<path d="M16 35V16l8-7 8 7v19"/><path d="M13 35h22M19 20c4-4 6 4 10 0M20 27c3-3 5 3 8 0"/>`,
    war: `<path d="M12 13h24v16a12 12 0 0 1-24 0V13Z"/><path d="M18 13V8m12 5V8M17 23h14M24 17v16"/>`,
    cloud: `<path d="M11 29c-5-8 5-14 11-9 3-9 16-6 15 3 7 1 6 10-1 10H12"/><path d="M16 38h17"/>`,
    mountain: `<path d="M6 37 19 12l6 12 5-8 12 21H6Z"/><path d="M24 37V25m-5 6 5-6 5 6"/>`,
    ancient: `<circle cx="24" cy="24" r="15"/><path d="M24 10v28M10 24h28M15 15l18 18M33 15 15 33"/>`,
    seal: `<circle cx="24" cy="24" r="16"/><path d="M17 16h14v16H17zM17 24h14M24 16v16"/>`,
  };
  return `<svg class="sect-icon" ${common}>${paths[name] || paths.seal}</svg>`;
}

const settings = () => state.publicInfo?.theme_settings || {};
const lore = (themed, plain) => settings().lore_mode === false ? plain : themed;
const pingKey = (uuid, taskId) => `${uuid}:${taskId}`;

function icon(name) {
  const paths = {
    atlas: "M4 12h16M12 4v16M5 5l14 14M19 5 5 19M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
    traffic: "M4 18V6m0 0-3 3m3-3 3 3m13 6V6m0 12-3-3m3 3 3-3M9 8h6M9 12h6M9 16h6",
    assets: "M3 7h18v12H3zM7 7V4h10v3M3 12h18M10 15h4",
    admin: "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5ZM19 12l2-1-2-3-2 .3-1-2.3L13 4h-2L9 5.7 7 5.4 5 8l1 2-2 1v2l2 1-1 2 2 2.6 2-.3 1 1.7h4l1-1.7 2 .3 2-2.6-1-2 2-1Z",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.atlas}"/></svg>`;
}

function flagMarkup(country) {
  const code = /^[A-Z]{2}$/.test(country.code) ? country.code : "XX";
  return `<span class="flag-icon flag-${code}" role="img" aria-label="${escapeHtml(country.name)}国旗"><i></i></span>`;
}

function navigate(path) {
  if (location.pathname !== path) history.pushState({}, "", path + (state.mock ? "?mock=1" : ""));
  render();
}

function currentRoute() {
  const match = location.pathname.match(/^\/instance\/([^/]+)/);
  if (match) return { page: "instance", uuid: decodeURIComponent(match[1]) };
  if (location.pathname.startsWith("/traffic")) return { page: "traffic" };
  if (location.pathname.startsWith("/assets")) return { page: "assets" };
  return { page: "home" };
}

function shell(content, active) {
  const title = settings().atlas_title || "朱雀星";
  const nav = [["home", "/", "atlas", lore("星域", "总览")], ["traffic", "/traffic", "traffic", lore("星路", "流量")], ["assets", "/assets", "assets", lore("山河册", "资产")]];
  const fontMode = ({ "颜楷风": "font-yan", "行书风": "font-xing", "宋韵风": "font-song", "现代易读": "font-modern" })[settings().font_style] || "font-yan";
  return `<div class="cosmos density-${escapeHtml(settings().star_density || "标准")} ${fontMode}">
    <header class="topbar km-navbar"><button class="brand" data-nav="/"><span class="brand-seal">逆</span><span><b>${escapeHtml(title)}</b><small>Komari · 非官方同人主题</small></span></button>
      <nav>${nav.map(([id, path, symbol, label]) => `<button data-nav="${path}" class="${active === id ? "active" : ""}">${icon(symbol)}<span>${escapeHtml(label)}</span></button>`).join("")}</nav>
      <div class="connection ${escapeHtml(state.connection)}"><i></i><span>${connectionText()}</span></div>
      <a class="admin-link" href="/admin" title="Komari 管理后台">${icon("admin")}</a>
    </header>
    ${content}
    <footer class="km-footer"><span>《仙逆》非官方、非商业同人主题</span><b>Powered by Komari Monitor.</b><span>代码与素材均本地运行</span></footer>
  </div>`;
}

function connectionText() {
  return ({ loading: "推演星图", connected: "星路畅通", reconnecting: "重连星路", error: "星路中断", mock: "演示星域" })[state.connection] || "未知";
}

function summary() {
  const online = state.nodes.filter((node) => node.online).length;
  const avgCpu = online ? state.nodes.filter((node) => node.online).reduce((sum, node) => sum + node.cpu, 0) / online : 0;
  const down = state.nodes.reduce((sum, node) => sum + node.netDown, 0);
  const up = state.nodes.reduce((sum, node) => sum + node.netUp, 0);
  const traffic = state.nodes.reduce((sum, node) => sum + node.totalDown + node.totalUp, 0);
  return { online, total: state.nodes.length, avgCpu, down, up, traffic };
}

function renderHome() {
  const info = summary();
  const filtered = filterNodes();
  const groups = countrySects(filtered);
  const allSects = countrySects(state.nodes);
  const showCharacter = settings().show_character !== false;
  const content = `<main class="atlas-page km-page-home">
    <section class="sky-overview frost-hero ${showCharacter ? "" : "character-hidden"}" data-frost-hero aria-labelledby="atlas-heading">
      ${showCharacter ? `<div class="hero-fallback" aria-hidden="true"></div><canvas class="hero-canvas" data-hero-canvas aria-hidden="true"></canvas>` : `<div class="hero-quiet" aria-hidden="true"><i></i></div>`}
      <div class="hero-veil" aria-hidden="true"></div>
      ${showCharacter ? `<div class="hero-wind" role="group" aria-label="灵风强度"><span>灵风</span>${[["静风","轻柔"],["灵风","标准"],["狂风","强烈"]].map(([label,value])=>`<button type="button" data-wind="${value}" class="${(settings().motion_strength || "标准") === value ? "active" : ""}">${label}</button>`).join("")}</div>` : ""}
      <div class="overview-copy"><p class="eyebrow">SUZAKU STAR · FROST REALM</p><h1 id="atlas-heading">${escapeHtml(settings().atlas_title || "朱雀星")}</h1><p>${lore("霜华照星海，一念观万宗。", "全部节点实时运行状态")}</p><span class="realm-mark">霜华境 · 非官方同人主题</span></div>
      <div class="overview-ledger">
        ${stat("星辰", "节点", `${info.online}<small> / ${info.total}</small>`, info.online === info.total ? "清明" : `${info.total - info.online}颗黯淡`, "nodes")}
        ${stat("本源", "平均 CPU", `${info.avgCpu.toFixed(1)}<small>%</small>`, info.avgCpu > 70 ? "气机偏高" : "运转平稳", "cpu")}
        ${stat("灵潮", "实时带宽", `↓ ${formatBytes(info.down, true)}`, `↑ ${formatBytes(info.up, true)}`, "bandwidth")}
        ${stat("岁月", "累计流量", formatBytes(info.traffic), `${groups.length}方星域`, "traffic")}
      </div>
    </section>
    ${renderSectGlobe(allSects)}
    <section class="atlas-body">
      <div class="atlas-heading"><div><p class="eyebrow">SECT ARRAY LEDGER</p><h2>${lore("宗门阵眼录", "节点列表")}</h2></div><p>一国一宗门，国旗保留真实归属；每台 VPS 都是宗门阵图中的一处阵眼。</p></div>
      <div class="atlas-tools"><label class="search"><span>寻星</span><input data-search value="${escapeHtml(state.search)}" placeholder="节点、地区、分组或服务商" /></label>
        <div class="segmented" role="group" aria-label="状态筛选">${[["all", "全部"], ["online", "在线"], ["warning", "波动"], ["offline", "离线"]].map(([value, label]) => `<button data-status="${value}" class="${state.status === value ? "active" : ""}">${label}</button>`).join("")}</div>
        <label class="sorter">排序<select data-sort><option value="weight" ${state.sort === "weight" ? "selected" : ""}>默认</option><option value="load" ${state.sort === "load" ? "selected" : ""}>负载</option><option value="traffic" ${state.sort === "traffic" ? "selected" : ""}>流量</option><option value="expiry" ${state.sort === "expiry" ? "selected" : ""}>到期</option></select></label>
      </div>
      ${state.country ? `<button class="country-filter" data-country="${escapeHtml(state.country)}"><span>舆图筛选</span>${flagMarkup(groups[0]?.country || { code: state.country, name: state.country })}<b>${escapeHtml(groups[0]?.country.name || state.country)}</b><i>×</i></button>` : ""}
      ${state.error ? `<div class="error-banner"><b>星图未能展开</b><span>${escapeHtml(state.error)}</span><button data-demo>进入演示星域</button></div>` : ""}
      <div class="stellar-ledger">${groups.length ? groups.map((group, index) => renderGroup(group, index)).join("") : emptyState()}</div>
    </section>
  </main>`;
  return shell(content, "home");
}

function stat(themed, plain, value, note, liveKey = "") {
  return `<div class="ledger-stat"${liveKey ? ` data-summary="${liveKey}"` : ""}><span>${lore(themed, plain)}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></div>`;
}

function filterNodes() {
  const search = state.search.trim().toLowerCase();
  let nodes = state.nodes.filter((node) => !search || [node.name, node.group, node.region, node.provider].some((value) => value.toLowerCase().includes(search)));
  if (state.country) nodes = nodes.filter((node) => countryIdentity(node.region).code === state.country);
  nodes = nodes.filter((node) => {
    const health = nodeHealth(node).key;
    if (state.status === "online") return node.online;
    if (state.status === "offline") return !node.online;
    if (state.status === "warning") return health === "warning" || health === "critical";
    return true;
  });
  return [...nodes].sort((left, right) => {
    if (state.sort === "load") return right.cpu - left.cpu;
    if (state.sort === "traffic") return right.totalDown + right.totalUp - left.totalDown - left.totalUp;
    if (state.sort === "expiry") return (expiryDays(left.expiredAt) ?? 99999) - (expiryDays(right.expiredAt) ?? 99999);
    return left.weight - right.weight || left.name.localeCompare(right.name, "zh-CN");
  });
}

function countrySects(nodes) {
  const aliases = parseAliases(settings().country_sects);
  const map = new Map();
  for (const node of nodes) {
    const country = countryIdentity(node.region);
    if (!map.has(country.code)) map.set(country.code, { country, nodes: [] });
    map.get(country.code).nodes.push(node);
  }
  return [...map.values()].map((entry) => ({
    ...entry,
    name: aliases.get(entry.country.code) || aliases.get(entry.country.name) || DEFAULT_SECTS[entry.country.code] || `${entry.country.name}宗`,
    sourceGroups: [...new Set(entry.nodes.map((node) => node.group))],
  })).sort((left, right) => right.nodes.filter((node) => node.online).length - left.nodes.filter((node) => node.online).length || left.country.code.localeCompare(right.country.code));
}

function renderSectGlobe(sects) {
  const points = sects.map((sect) => {
    const [lat, lng] = GEO_COORDS[sect.country.code] || GEO_COORDS["--"];
    const online = sect.nodes.filter((node) => node.online).length;
    const active = state.country === sect.country.code ? "active" : "";
    return `<button class="globe-node ${active}" data-country="${escapeHtml(sect.country.code)}" data-lat="${lat}" data-lng="${lng}" title="${escapeHtml(sect.country.name)} · ${escapeHtml(sect.name)} · ${online}/${sect.nodes.length}" aria-label="筛选 ${escapeHtml(sect.country.name)} · ${escapeHtml(sect.name)}">${flagMarkup(sect.country)}</button>`;
  }).join("");
  const ledger = sects.map((sect) => {
    const online = sect.nodes.filter((node) => node.online).length;
    return `<button class="globe-ledger-row ${state.country === sect.country.code ? "active" : ""}" data-country="${escapeHtml(sect.country.code)}">
      ${flagMarkup(sect.country)}<span><b>${escapeHtml(sect.name)}</b><small>${escapeHtml(sect.country.name)} · ${escapeHtml(sect.country.code)}</small></span><em>${online}/${sect.nodes.length}</em><i>阵眼</i>
    </button>`;
  }).join("");
  return `<section class="sect-globe" data-sect-globe aria-labelledby="sect-globe-title">
    <header><div><p class="eyebrow">SUZAKU STAR · SECT COORDINATES</p><h2 id="sect-globe-title">朱雀星舆图</h2></div><p><b>一国一宗门 · 经纬皆真实</b><span>拖动星体查看诸国宗门；星体会缓慢自转，点击国旗或右侧宗门即可筛选阵眼。</span></p></header>
    <div class="sect-globe-layout">
      <div class="sect-globe-shell">
        <canvas data-globe-canvas aria-hidden="true"></canvas>
        <div class="globe-nodes">${points || `<p class="map-empty">尚未发现可定位的宗门阵眼</p>`}</div>
        <p class="globe-hint">按住拖动 · 自动巡星 · 离开视口自动停转</p>
      </div>
      <aside class="globe-ledger"><div class="globe-ledger-heading"><span>宗门坐标录</span><b>${sects.length}</b><small>方宗门</small></div>${ledger}</aside>
    </div>
  </section>`;
}

function renderGroup(group, index) {
  const online = group.nodes.filter((node) => node.online).length;
  const visual = sectVisual(group.name, group.sourceGroups.join(" "));
  return `<section class="star-region ${visual.slug} tone-${visual.tone}" data-sect-country="${escapeHtml(group.country.code)}"><div class="sect-backdrop" aria-hidden="true"></div><header><span class="region-index">${String(index + 1).padStart(2, "0")}</span><div class="sect-title"><p>${escapeHtml(group.country.name)} · ${escapeHtml(group.country.code)} · SECT DOMAIN</p><span class="sect-emblem">${sectIcon(visual.icon, `${group.name}印记`)}</span><h3>${escapeHtml(group.name)}</h3><small>${escapeHtml(visual.verse)}</small></div><div class="region-count"><div class="region-flags"><span title="${escapeHtml(group.country.name)}">${flagMarkup(group.country)}<small>${escapeHtml(group.country.code)}</small></span></div><b>${online}/${group.nodes.length}</b><span>宗门阵眼运转</span></div></header>
    <div class="region-lines">${group.nodes.map((node) => renderNodeRow(node, visual.slug)).join("")}</div></section>`;
}

function sceneForGroup(groupName, alias = "") {
  return sectVisual(groupName, alias || parseAliases(settings().group_aliases).get(groupName) || "").slug;
}

function renderNodeRow(node, scene = sceneForGroup(node.group)) {
  const health = nodeHealth(node);
  const ram = ratio(node.ramUsed, node.ramTotal), disk = ratio(node.diskUsed, node.diskTotal);
  const pings = state.tasks.map((task) => state.pings.get(pingKey(node.uuid, task.id))).filter(Boolean);
  const latency = pings.length ? pings.reduce((sum, item) => sum + (item.latest || item.avg || 0), 0) / pings.length : null;
  const expiry = expiryDays(node.expiredAt);
  const country = countryIdentity(node.region);
  return `<article class="star-line ${scene} ${health.key} km-node-display" data-node-uuid="${escapeHtml(node.uuid)}" data-nav="/instance/${encodeURIComponent(node.uuid)}" tabindex="0" role="link" aria-label="查看 ${escapeHtml(node.name)}">
    <div class="star-identity"><div class="sect-thumbnail"><i style="--heat:${node.cpu}%"></i><span>${node.online ? "阵启" : "阵寂"}</span></div><div class="country-mark" title="${escapeHtml(country.name)}">${flagMarkup(country)}<small>${escapeHtml(country.code)}</small></div><div class="identity-copy"><div class="star-title"><h4>${escapeHtml(node.name)}</h4><span class="health-tag">${lore(health.label, health.plain)}</span></div><p>${escapeHtml(node.region)} · ${escapeHtml(node.group)}${settings().show_provider === false ? "" : ` · ${escapeHtml(node.provider)}`}</p></div></div>
    <div class="metric-runes">${rune("CPU", node.cpu)}${rune("内存", ram)}${rune("硬盘", disk)}</div>
    <div class="network-rune"><span>实时灵潮</span><b>↓ ${formatBytes(node.netDown, true)}</b><b>↑ ${formatBytes(node.netUp, true)}</b></div>
    <div class="node-ledger"><span><small>累计</small><b>${formatBytes(node.totalDown + node.totalUp)}</b></span><span><small>星路</small><b>${latency === null ? "暂无" : `${latency.toFixed(0)} ms`}</b></span><span><small>在线</small><b>${formatDuration(node.uptime)}</b></span></div>
    ${settings().show_billing === false ? "" : `<div class="billing-rune"><span>${money(node)}</span><b class="${expiry !== null && expiry < 15 ? "urgent" : ""}">${expiry === null ? "未设到期" : expiry < 0 ? `逾期 ${Math.abs(expiry)} 天` : `${expiry} 天后到期`}</b></div>`}
    <span class="line-arrow">观测 <i>→</i></span>
  </article>`;
}

function rune(label, value) {
  return `<div class="metric-rune"><span>${label}</span><b>${value.toFixed(0)}%</b><i><em style="width:${Math.min(100, value)}%"></em></i></div>`;
}

function emptyState() { return `<div class="empty-state"><b>星海寂静</b><p>没有符合当前筛选条件的节点。</p></div>`; }

function renderDetail(uuid) {
  const node = state.nodes.find((item) => item.uuid === uuid);
  if (!node) return shell(`<main class="not-found"><p class="eyebrow">LOST STAR</p><h1>未寻得此星</h1><button data-nav="/">返回朱雀星图</button></main>`, "home");
  ensureHistory(node);
  ensurePingHistory(node);
  const health = nodeHealth(node), historyData = state.histories.get(node.uuid) || syntheticHistory(node);
  const ram = ratio(node.ramUsed, node.ramTotal), swap = ratio(node.swapUsed, node.swapTotal), disk = ratio(node.diskUsed, node.diskTotal), expiry = expiryDays(node.expiredAt);
  const quota = trafficUsage(node);
  const peakDown = Math.max(0, ...(historyData.down || [])), peakUp = Math.max(0, ...(historyData.up || []));
  const delta = (values = []) => values.length > 1 ? Math.max(0, values.at(-1) - values[0]) : 0;
  const todayDown = delta(historyData.totalDown), todayUp = delta(historyData.totalUp);
  const pings = state.tasks.map((task) => ({ task, stat: state.pings.get(pingKey(node.uuid, task.id)) }));
  const pingHistory = state.pingHistories.get(node.uuid) || [];
  const nodeSect = countrySects([node])[0];
  const visual = sectVisual(nodeSect?.name || node.group, node.group);
  const scene = visual.slug;
  const country = countryIdentity(node.region);
  const content = `<main class="detail-page km-page-instance">
    <header class="detail-hero ${scene} tone-${visual.tone}"><button data-nav="/" class="back">← 返回星图</button><div class="detail-orb ${health.key}"><i>${sectIcon(visual.icon, `${nodeSect?.name || node.group}印记`)}</i><span>${lore("宗门地界", "节点场景")}</span></div><div><p class="eyebrow">STELLAR OBSERVATORY · 星辰观测</p><div class="detail-country">${flagMarkup(country)}<span>${escapeHtml(country.code)} · ${escapeHtml(country.name)}</span></div><h1>${escapeHtml(node.name)}</h1><p>${escapeHtml(node.region)} · ${escapeHtml(node.group)} · ${escapeHtml(node.provider)}</p></div><div class="detail-state"><span>${lore(health.label, health.plain)}</span><b>${node.online ? "ONLINE" : "OFFLINE"}</b></div></header>
    <section class="detail-strip">${detailStat("CPU", `${node.cpu.toFixed(1)}%`, node.cpu)}${detailStat("内存", `${ram.toFixed(1)}%`, ram)}${detailStat("Swap", node.swapTotal ? `${swap.toFixed(1)}%` : "无", swap)}${detailStat("硬盘", `${disk.toFixed(1)}%`, disk)}${detailStat("温度", node.temperature === null ? "暂无" : `${node.temperature.toFixed(0)}℃`, node.temperature || 0)}${detailStat("在线", formatDuration(node.uptime), 100)}</section>
    <div class="detail-layout"><section class="observatory-main">
      <div class="section-title"><div><p class="eyebrow">THE FLOW OF ORIGIN</p><h2>${lore("本源流转", "资源历史")}</h2></div><span>最近 24 小时</span></div>
      ${lineChart([{ label: "CPU", values: historyData.cpu, color: "#d34a43" }, { label: "内存", values: historyData.ram, color: "#91b7bd" }, { label: "硬盘", values: historyData.disk, color: "#d5b36a" }], { max: 100, unit: "%", label: "资源历史趋势" })}
      <div class="section-title network-title"><div><p class="eyebrow">SYSTEM PULSE</p><h2>${lore("灵台脉象", "系统历史")}</h2></div><span>负载 · 进程 · 连接</span></div>
      ${lineChart([{ label: "Swap %", values: historyData.swap || [], color: "#7d72b8" }, { label: "负载", values: historyData.load || [], color: "#c57a4a" }, { label: "温度 ℃", values: historyData.temperature || [], color: "#b64a55" }], { unit: "混合值", label: "系统历史趋势" })}
      ${lineChart([{ label: "进程", values: historyData.process || [], color: "#d5b36a" }, { label: "TCP", values: historyData.tcp || [], color: "#5c9eaa" }, { label: "UDP", values: historyData.udp || [], color: "#8a74b9" }], { unit: "数量", label: "进程与连接历史趋势" })}
      <div class="section-title network-title"><div><p class="eyebrow">STAR TIDE</p><h2>${lore("星河潮汐", "网络历史")}</h2></div><span>MB/s</span></div>
      ${lineChart([{ label: "下载", values: historyData.down, color: "#91b7bd" }, { label: "上传", values: historyData.up, color: "#d5b36a" }], { unit: "MB/s", label: "网络历史趋势" })}
      <div class="section-title"><div><p class="eyebrow">STAR PATH</p><h2>${lore("星路传讯", "Ping 线路")}</h2></div></div>
      <div class="ping-table">${pings.length ? pings.map(({ task, stat }) => `<div><span>${escapeHtml(task.name)}</span><b>${stat?.latest == null ? "无数据" : `${Number(stat.latest).toFixed(0)} ms`}</b><em>${stat?.loss == null ? "—" : `丢包 ${Number(stat.loss).toFixed(1)}%`}</em><small>${stat?.avg == null ? "" : `均值 ${Number(stat.avg).toFixed(0)} · P50 ${Number(stat.p50 ?? stat.avg).toFixed(0)} · P99 ${Number(stat.p99 ?? stat.avg).toFixed(0)} · σ ${Number(stat.stddev ?? 0).toFixed(1)}`}</small></div>`).join("") : `<p>当前没有公开 Ping 任务。</p>`}</div>
      ${pingHistory.length ? lineChart(pingHistory.map((entry, index) => ({ label: entry.task.name, values: entry.values, color: ["#d34a43", "#5c9eaa", "#d5b36a", "#8a74b9"][index % 4] })), { unit: "ms", label: "Ping 历史趋势" }) : ""}
    </section><aside class="star-inspector">
      <div class="inspector-heading"><p class="eyebrow">STAR RECORD</p><h2>${lore("星辰铭录", "节点信息")}</h2></div>
      ${record("处理器", node.cpuName)}${record("核心", `${node.cpuCores || "—"} vCPU`)}${record("显卡", node.gpuName)}${record("系统", `${node.os} · ${node.arch}`)}${record("内核", node.kernelVersion)}${record("虚拟化", node.virtualization)}${record("内存", `${formatBytes(node.ramUsed)} / ${formatBytes(node.ramTotal)}`)}${record("Swap", node.swapTotal ? `${formatBytes(node.swapUsed)} / ${formatBytes(node.swapTotal)}` : "无")}${record("负载", `${node.load1.toFixed(2)} / ${node.load5.toFixed(2)} / ${node.load15.toFixed(2)}`)}${record("进程", `${node.processes}`)}${record("连接", `TCP ${node.tcp} · UDP ${node.udp}`)}${record("累计下行", formatBytes(node.totalDown))}${record("累计上行", formatBytes(node.totalUp))}${record("今日流量", todayDown || todayUp ? `↓ ${formatBytes(todayDown)} · ↑ ${formatBytes(todayUp)}` : "等待历史数据")}${record("24h 峰值", `↓ ${formatBytes(peakDown * 1024 ** 2, true)} · ↑ ${formatBytes(peakUp * 1024 ** 2, true)}`)}${record("流量限额", quota.limit ? `${formatBytes(quota.used)} / ${formatBytes(quota.limit)} · ${quota.type.toUpperCase()}` : "不限额")}${record("最近上报", formatDateTime(node.updatedAt))}${node.tags ? record("标签", node.tags) : ""}
      ${settings().show_billing === false ? "" : `<div class="billing-inspector"><span>供奉 / 账期</span><b>${money(node)}</b><p>${formatDate(node.expiredAt)} · ${expiry === null ? "未设" : expiry < 0 ? "已到期" : `剩余 ${expiry} 天`} · ${node.autoRenewal ? "自动续费" : "手动续费"}</p></div>`}
      ${node.publicRemark ? `<blockquote>${escapeHtml(node.publicRemark)}</blockquote>` : ""}
    </aside></div>${renderIpPanel(node)}
  </main>`;
  return shell(content, "home");
}

function detailStat(label, value, percent) { return `<div><span>${label}</span><b>${escapeHtml(value)}</b><i><em style="width:${Math.min(100, percent)}%"></em></i></div>`; }
function record(label, value) { return `<div class="record-row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`; }
function formatDateTime(value) {
  if (!value) return "暂无";
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? "暂无" : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function renderIpPanel(node) {
  if (settings().show_network_identity !== true) return "";
  const profile = state.ipProfiles.get(node.uuid);
  if (!node.ipv4 && !node.ipv6) return `<section class="ip-intel"><header><div><p class="eyebrow">NETWORK IDENTITY</p><h2>网络身份</h2></div><span>该节点没有公开 IP 数据</span></header></section>`;
  if (!profile || profile.loading) return `<section class="ip-intel loading"><header><div><p class="eyebrow">NETWORK IDENTITY</p><h2>网络身份推演</h2></div><span>正在读取 Komari IP 信息插件…</span></header></section>`;
  if (profile.error) return `<section class="ip-intel"><header><div><p class="eyebrow">NETWORK IDENTITY</p><h2>网络身份</h2></div><span>插件不可用，不影响节点监控</span></header></section>`;
  return `<section class="ip-intel"><header><div><p class="eyebrow">NETWORK IDENTITY · OPTIONAL PLUGIN</p><h2>网络身份与全球延迟</h2></div><span>仅在显式开启后显示</span></header><div class="ip-families">${profile.items.map((item) => {
    const data = item.lookup?.data || item.lookup || {}, latency = item.latency?.data?.latency || item.latency?.latency;
    const location = data.location || {}, network = data.network || {}, classification = data.classification || item.latency?.data?.classification || {};
    const reputation = data.reputation || {};
    return `<article class="ip-family"><div class="ip-address"><span>IPv${data.address?.family || (item.ip.includes(":") ? 6 : 4)}</span><b>${escapeHtml(data.address?.value || item.ip)}</b><em>${escapeHtml(classification.label || classification.type || "未分类")}</em></div><div class="ip-grid">${record("位置", [location.country, location.region, location.city].filter(Boolean).join(" · ") || "暂无")}${record("注册地", [location.registered_country, location.registered_country_code].filter(Boolean).join(" · ") || "暂无")}${record("ASN", network.asn || "暂无")}${record("运营商", network.operator || network.organization || "暂无")}${record("网络类型", network.network_type || network.company_type || "暂无")}${record("网段 / 域名", [network.route, network.domain].filter(Boolean).join(" · ") || "暂无")}${reputation.available ? record("风险 / 纯净度", `${reputation.risk_score ?? "—"} / ${reputation.purity_score ?? "—"}`) : ""}</div>${latency?.nodes?.length ? `<div class="global-latency">${latency.nodes.map((entry) => `<span>${escapeHtml(entry.country_code || "--")} · ${escapeHtml(entry.name || entry.city || "节点")}<b>${entry.latency_ms == null ? "超时" : `${Number(entry.latency_ms).toFixed(0)} ms`}</b></span>`).join("")}</div>` : `<p class="ip-note">全球延迟数据暂不可用</p>`}</article>`;
  }).join("")}</div></section>`;
}

async function ensureIpProfile(node) {
  if (!node || settings().show_network_identity !== true || state.ipProfiles.has(node.uuid)) return;
  const addresses = [node.ipv4, node.ipv6].filter(Boolean);
  if (!addresses.length) return;
  state.ipProfiles.set(node.uuid, { loading: true, items: [] });
  if (state.mock) {
    const country = countryIdentity(node.region);
    state.ipProfiles.set(node.uuid, { loading: false, items: addresses.map((ip) => ({ ip, lookup: { data: { address: { value: ip, family: ip.includes(":") ? 6 : 4 }, location: { country: country.name, region: node.region, city: node.region, registered_country: country.name, registered_country_code: country.code }, network: { asn: "AS64500", operator: node.provider, network_type: "hosting", route: ip.includes(":") ? "2001:db8::/32" : "203.0.113.0/24", domain: "example.net" }, classification: { type: "native", label: "原生 IP" }, reputation: { available: false } } }, latency: { data: { latency: { nodes: [{ country_code: "HK", name: "香港", latency_ms: 18 }, { country_code: "JP", name: "东京", latency_ms: 42 }, { country_code: "SG", name: "新加坡", latency_ms: 58 }, { country_code: "US", name: "洛杉矶", latency_ms: 148 }] } } } })) });
    if (currentRoute().page === "instance") render();
    return;
  }
  try {
    const status = await loadIpPluginStatus();
    if (status?.data?.available === false) throw new Error("IP info plugin unavailable");
    const items = await Promise.all(addresses.map(async (ip) => ({ ip, lookup: await loadIpInfo(node.uuid, ip), latency: await loadIpLatency(node.uuid, ip).catch(() => null) })));
    state.ipProfiles.set(node.uuid, { loading: false, items });
  } catch (error) {
    state.ipProfiles.set(node.uuid, { loading: false, error: String(error), items: [] });
  }
  if (currentRoute().page === "instance" && currentRoute().uuid === node.uuid) render();
}

function renderTraffic() {
  const nodes = [...state.nodes].sort((a, b) => b.totalDown + b.totalUp - a.totalDown - a.totalUp);
  const totalDown = nodes.reduce((sum, node) => sum + node.totalDown, 0), totalUp = nodes.reduce((sum, node) => sum + node.totalUp, 0);
  const max = Math.max(1, ...nodes.map((node) => node.totalDown + node.totalUp));
  const content = `<main class="data-page km-page-traffic"><header class="page-heading"><p class="eyebrow">STAR PATH · NETWORK</p><h1>${lore("星路潮汐", "流量统计")}</h1><p>每一条星路都保留真实单位和节点名称，仙逆文案只作为视觉语境。</p></header>
    <section class="flow-totals"><div><span>累计下行</span><b>${formatBytes(totalDown)}</b></div><div><span>累计上行</span><b>${formatBytes(totalUp)}</b></div><div><span>实时下行</span><b>${formatBytes(nodes.reduce((s,n)=>s+n.netDown,0), true)}</b></div><div><span>实时上行</span><b>${formatBytes(nodes.reduce((s,n)=>s+n.netUp,0), true)}</b></div></section>
    <section class="rank-ledger"><header><span>星辰</span><span>流量构成</span><span>实时速率</span><span>限额占用</span></header>${nodes.map((node, index) => {
      const total = node.totalDown + node.totalUp, quota = trafficUsage(node), limit = quota.percent;
      const country = countryIdentity(node.region);
      return `<div class="rank-row" data-nav="/instance/${encodeURIComponent(node.uuid)}"><b class="rank">${String(index + 1).padStart(2, "0")}</b><div class="rank-name"><strong>${flagMarkup(country)}${escapeHtml(node.name)}</strong><small>${escapeHtml(country.code)} · ${escapeHtml(node.region)}</small></div><div class="flow-line"><i><em style="width:${total / max * 100}%"></em></i><span>↓ ${formatBytes(node.totalDown)} · ↑ ${formatBytes(node.totalUp)}</span></div><div class="live-flow"><b>↓ ${formatBytes(node.netDown, true)}</b><span>↑ ${formatBytes(node.netUp, true)}</span></div><div class="limit-flow"><b>${limit === null ? "未设置" : `${limit.toFixed(1)}%`}</b><span>${quota.limit ? `${formatBytes(quota.used)} / ${formatBytes(quota.limit)} · ${quota.type.toUpperCase()}` : "不限额"}</span></div></div>`;
    }).join("")}</section></main>`;
  return shell(content, "traffic");
}

function renderAssets() {
  const providers = new Map(), currencies = new Map();
  state.nodes.forEach((node) => { providers.set(node.provider, (providers.get(node.provider) || 0) + 1); if (node.price !== null) currencies.set(node.currency, (currencies.get(node.currency) || 0) + node.price); });
  const expiring = [...state.nodes].filter((node) => expiryDays(node.expiredAt) !== null).sort((a,b)=>(expiryDays(a.expiredAt)||0)-(expiryDays(b.expiredAt)||0));
  const content = `<main class="data-page km-page-assets"><header class="page-heading"><p class="eyebrow">MOUNTAINS & RIVERS · ASSETS</p><h1>${lore("山河册", "资产统计")}</h1><p>费用不调用任何第三方汇率接口；不同币种分别汇总，避免错误换算。</p></header>
    <section class="asset-ink"><div class="asset-total"><span>名录星辰</span><b>${state.nodes.length}</b><small>${state.nodes.filter(n=>n.online).length} 颗在线</small></div><div class="currency-list">${[...currencies.entries()].map(([currency,total])=>`<p><span>${escapeHtml(currency)} 币种合计</span><b>${escapeHtml(currency)}${total.toFixed(2)}</b></p>`).join("") || `<p><span>费用</span><b>未设置</b></p>`}</div><div class="provider-list"><span>服务商分布</span>${[...providers.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>`<p><b>${escapeHtml(name)}</b><em>${count}台</em></p>`).join("")}</div></section>
    <section class="expiry-ledger"><header><span>星辰</span><span>服务商</span><span>账期</span><span>到期日</span><span>余期</span></header>${expiring.map((node)=>{const days=expiryDays(node.expiredAt);return `<div data-nav="/instance/${encodeURIComponent(node.uuid)}"><b>${escapeHtml(node.name)}</b><span>${escapeHtml(node.provider)}</span><span>${money(node)}</span><span>${formatDate(node.expiredAt)}</span><strong class="${days < 15 ? "urgent" : ""}">${days < 0 ? `逾期 ${Math.abs(days)} 天` : `${days} 天`}</strong></div>`;}).join("")}</section></main>`;
  return shell(content, "assets");
}

function syntheticHistory(node) {
  const current = state.mock ? demoHistory(node) : null;
  if (current) return current;
  return { cpu: [node.cpu], ram: [ratio(node.ramUsed,node.ramTotal)], swap: [ratio(node.swapUsed,node.swapTotal)], disk: [ratio(node.diskUsed,node.diskTotal)], load: [node.load1], temperature: [node.temperature || 0], process: [node.processes], tcp: [node.tcp], udp: [node.udp], down: [node.netDown/1024**2], up: [node.netUp/1024**2], totalDown: [node.totalDown], totalUp: [node.totalUp] };
}

async function ensureHistory(node) {
  if (state.histories.has(node.uuid)) return;
  if (state.mock) { state.histories.set(node.uuid, demoHistory(node)); return; }
  state.histories.set(node.uuid, syntheticHistory(node));
  try {
    const payload = await loadHistory(node.uuid);
    const series = payload?.series ?? payload?.data?.series ?? [];
    const values = (key) => (series.find((entry) => (entry.metric_key || entry.name) === key)?.points || []).map((point) => Number(Array.isArray(point) ? point[1] : point?.value)).filter(Number.isFinite);
    const memoryUsed = values("memory.used"), memoryTotal = values("memory.total"), swapUsed = values("swap.used"), swapTotal = values("swap.total"), diskUsed = values("disk.used"), diskTotal = values("disk.total");
    const data = { cpu: values("cpu.usage"), ram: memoryUsed.map((value,index)=>ratio(value,memoryTotal[index]||node.ramTotal)), swap: swapUsed.map((value,index)=>ratio(value,swapTotal[index]||node.swapTotal)), disk: diskUsed.map((value,index)=>ratio(value,diskTotal[index]||node.diskTotal)), load: values("load.average"), temperature: values("temperature"), process: values("process.count"), tcp: values("connections.tcp"), udp: values("connections.udp"), down: values("net.in.rate").map(v=>v/1024**2), up: values("net.out.rate").map(v=>v/1024**2), totalDown: values("net.total.down"), totalUp: values("net.total.up") };
    if (Object.values(data).some((list)=>list.length>1)) { state.histories.set(node.uuid, data); if (currentRoute().page === "instance") render(); }
  } catch (error) { console.info("Zhuque Star history unavailable", error); }
}

async function ensurePingHistory(node) {
  if (!node || state.pingHistories.has(node.uuid)) return;
  if (state.mock) {
    state.pingHistories.set(node.uuid, state.tasks.map((task) => ({ task, values: demoPingHistory(node, task) })));
    return;
  }
  state.pingHistories.set(node.uuid, []);
  try {
    const payload = await loadPingHistory(node.uuid);
    const records = payload?.records ?? payload?.data?.records ?? (Array.isArray(payload) ? payload : []);
    const grouped = new Map(state.tasks.map((task) => [String(task.id), { task, values: [] }]));
    for (const record of records) {
      const entry = grouped.get(String(record.task_id ?? record.taskId));
      const value = Number(record.value ?? record.latency ?? record.ping);
      if (entry && Number.isFinite(value) && value >= 0) entry.values.push(value);
    }
    const histories = [...grouped.values()].filter((entry) => entry.values.length);
    state.pingHistories.set(node.uuid, histories);
    if (currentRoute().page === "instance" && currentRoute().uuid === node.uuid) render();
  } catch (error) { console.info("Zhuque Star ping history unavailable", error); }
}

async function initialize() {
  state.mock = new URLSearchParams(location.search).get("mock") === "1" || location.protocol === "file:";
  if (state.mock) {
    state.publicInfo = structuredClone(demoPublicInfo); state.nodes = normalizeNodes(demoNodes, { includeSensitive: settings().show_network_identity === true }); state.tasks = demoTasks; state.connection = "mock";
    state.nodes.forEach((node) => state.tasks.forEach((task) => state.pings.set(pingKey(node.uuid, task.id), demoPing(node, task)))); render(); return;
  }
  adoptTemporaryAccessKey(); render();
  try {
    const data = await loadPublicData();
    state.publicInfo = data.publicInfo || state.publicInfo; state.nodes = normalizeNodes(data.nodes, { includeSensitive: settings().show_network_identity === true }); state.tasks = Array.isArray(data.tasks) ? data.tasks : data.tasks?.tasks || [];
    if (!state.nodes.length) throw new Error("当前访客没有可见节点");
    await refreshStatus(); state.connection = "connected"; state.error = ""; render(); loadPings(); connectRealtime();
  } catch (error) { state.connection = "error"; state.error = `未能读取 Komari 公开节点：${error.message}`; render(); }
}

async function refreshStatus() {
  const payload = await loadLatestStatus();
  const raw = payload?.data?.data ?? payload?.data ?? payload?.result ?? payload;
  if (raw && typeof raw === "object") state.nodes = state.nodes.map((node) => raw[node.uuid] ? mergeStatus(node, raw[node.uuid]) : node);
}

async function loadPings() {
  if (!state.nodes.length || !state.tasks.length) return;
  try {
    const payload = await loadPingStats(state.nodes.map(n=>n.uuid), state.tasks.map(t=>t.id));
    const stats = payload?.stats ?? payload?.data?.stats ?? payload?.records ?? [];
    for (const item of stats) state.pings.set(pingKey(String(item.entity_id || item.uuid || item.client), item.task_id ?? item.taskId), { latest: item.latest, avg: item.avg, min: item.min, max: item.max, loss: Number(item.loss || 0) <= 1 ? Number(item.loss || 0) * 100 : Number(item.loss || 0), p50: item.p50, p99: item.p99, stddev: item.stddev });
    refreshCurrentView();
  } catch (error) { console.info("Zhuque Star ping stats unavailable", error); }
}

function connectRealtime() {
  state.socket?.close();
  state.socket = openRealtime((payload) => {
    const body = payload?.result ?? payload?.data ?? payload; const map = body?.clients ?? body?.statuses ?? body;
    if (map && typeof map === "object" && !Array.isArray(map)) { state.nodes = state.nodes.map((node) => map[node.uuid] ? mergeStatus(node, map[node.uuid]) : node); refreshCurrentView(); }
  }, (status) => { state.connection = status; refreshCurrentView(); if (status === "reconnecting") { clearTimeout(state.timer); state.timer = setTimeout(connectRealtime, 4000); } });
}

function setText(element, value) {
  if (element && element.textContent !== String(value)) element.textContent = String(value);
}

function setMarkup(element, value) {
  if (element && element.innerHTML !== value) element.innerHTML = value;
}

function patchConnection() {
  const element = app.querySelector(".connection");
  if (!element) return;
  element.className = `connection ${state.connection}`;
  setText(element.querySelector("span"), connectionText());
}

function patchHomeLive() {
  const info = summary();
  const summaries = {
    nodes: [`${info.online}<small> / ${info.total}</small>`, info.online === info.total ? "清明" : `${info.total - info.online}颗黯淡`],
    cpu: [`${info.avgCpu.toFixed(1)}<small>%</small>`, info.avgCpu > 70 ? "气机偏高" : "运转平稳"],
    bandwidth: [`↓ ${formatBytes(info.down, true)}`, `↑ ${formatBytes(info.up, true)}`],
    traffic: [formatBytes(info.traffic), `${countrySects(state.nodes).length}方星域`],
  };
  for (const [key, [value, note]] of Object.entries(summaries)) {
    const element = app.querySelector(`[data-summary="${key}"]`);
    setMarkup(element?.querySelector("strong"), value);
    setText(element?.querySelector("small"), note);
  }

  const nodeMap = new Map(state.nodes.map((node) => [node.uuid, node]));
  app.querySelectorAll("[data-node-uuid]").forEach((row) => {
    const node = nodeMap.get(row.dataset.nodeUuid);
    if (!node) return;
    const health = nodeHealth(node);
    const ram = ratio(node.ramUsed, node.ramTotal), disk = ratio(node.diskUsed, node.diskTotal);
    row.classList.remove("healthy", "warning", "critical", "offline");
    row.classList.add(health.key);
    setText(row.querySelector(".health-tag"), lore(health.label, health.plain));
    setText(row.querySelector(".sect-thumbnail span"), node.online ? "阵启" : "阵寂");
    row.querySelector(".sect-thumbnail i")?.style.setProperty("--heat", `${node.cpu}%`);
    const metrics = [node.cpu, ram, disk];
    row.querySelectorAll(".metric-rune").forEach((metric, index) => {
      const value = metrics[index] || 0;
      setText(metric.querySelector("b"), `${value.toFixed(0)}%`);
      metric.querySelector("em")?.style.setProperty("width", `${Math.min(100, value)}%`);
    });
    const network = row.querySelectorAll(".network-rune b");
    setText(network[0], `↓ ${formatBytes(node.netDown, true)}`);
    setText(network[1], `↑ ${formatBytes(node.netUp, true)}`);
    const ledger = row.querySelectorAll(".node-ledger b");
    setText(ledger[0], formatBytes(node.totalDown + node.totalUp));
    const pings = state.tasks.map((task) => state.pings.get(pingKey(node.uuid, task.id))).filter(Boolean);
    const latency = pings.length ? pings.reduce((sum, item) => sum + (item.latest || item.avg || 0), 0) / pings.length : null;
    setText(ledger[1], latency === null ? "暂无" : `${latency.toFixed(0)} ms`);
    setText(ledger[2], formatDuration(node.uptime));
  });

  for (const group of countrySects(state.nodes)) {
    const online = group.nodes.filter((node) => node.online).length;
    setText(app.querySelector(`[data-sect-country="${group.country.code}"] .region-count>b`), `${online}/${group.nodes.length}`);
    setText(app.querySelector(`.globe-ledger-row[data-country="${group.country.code}"] em`), `${online}/${group.nodes.length}`);
  }
}

function refreshCurrentView() {
  patchConnection();
  if (currentRoute().page === "home" && app.querySelector(".km-page-home")) {
    patchHomeLive();
    return;
  }
  render();
}

function render() {
  disposeHeroMotion();
  disposeSectGlobe();
  disposeHeroMotion = () => {};
  disposeSectGlobe = () => {};
  const route = currentRoute();
  app.innerHTML = route.page === "instance" ? renderDetail(route.uuid) : route.page === "traffic" ? renderTraffic() : route.page === "assets" ? renderAssets() : renderHome();
  if (route.page === "home") {
    disposeHeroMotion = mountHeroMotion(app.querySelector("[data-frost-hero]"), { enabled: settings().motion_enabled !== false, strength: settings().motion_strength });
    disposeSectGlobe = mountSectGlobe(app.querySelector("[data-sect-globe]"));
  }
  if (route.page === "instance") ensureIpProfile(state.nodes.find((node) => node.uuid === route.uuid));
}

app.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]"); if (nav) { event.preventDefault(); navigate(nav.dataset.nav); return; }
  const status = event.target.closest("[data-status]"); if (status) { state.status = status.dataset.status; render(); return; }
  const country = event.target.closest("[data-country]"); if (country) { state.country = state.country === country.dataset.country ? "" : country.dataset.country; render(); requestAnimationFrame(() => app.querySelector(".atlas-body")?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
  if (event.target.closest("[data-demo]")) { history.replaceState({}, "", "/?mock=1"); initialize(); }
});
app.addEventListener("keydown", (event) => { const row = event.target.closest("[data-nav]"); if (row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); navigate(row.dataset.nav); } });
app.addEventListener("input", (event) => { if (event.target.matches("[data-search]")) { state.search = event.target.value; const position = event.target.selectionStart; render(); const input = app.querySelector("[data-search]"); input?.focus(); input?.setSelectionRange(position, position); } });
app.addEventListener("change", (event) => { if (event.target.matches("[data-sort]")) { state.sort = event.target.value; render(); } });
window.addEventListener("popstate", render);

initialize();
