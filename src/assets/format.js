export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
export const ratio = (used, total) => Number(total) > 0 ? clamp(Number(used) / Number(total) * 100) : 0;
export const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

export function formatBytes(value, rate = false) {
  const number = Math.max(0, finite(value));
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = number;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  const digits = size >= 100 || index === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[index]}${rate ? "/s" : ""}`;
}

export function formatDuration(seconds) {
  let value = Math.max(0, Math.floor(finite(seconds)));
  const days = Math.floor(value / 86400); value %= 86400;
  const hours = Math.floor(value / 3600); value %= 3600;
  const minutes = Math.floor(value / 60);
  return days ? `${days}天 ${hours}时` : hours ? `${hours}时 ${minutes}分` : `${minutes}分钟`;
}

export function formatDate(value) {
  if (!value) return "未设置";
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? "未设置" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function expiryDays(value) {
  if (!value) return null;
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function money(node) {
  if (!Number.isFinite(node.price)) return "未设置";
  const raw = node.billingCycle;
  const aliases = { month: "月", monthly: "月", year: "年", yearly: "年", annual: "年", quarter: "季度", quarterly: "季度", week: "周", weekly: "周", day: "天", once: "一次性" };
  const cycle = Number.isFinite(Number(raw)) && String(raw).trim() !== "" ? `${Number(raw)}天` : aliases[String(raw || "").toLowerCase()] || String(raw || "周期");
  return `${node.currency || "¥"}${node.price.toFixed(node.price % 1 ? 2 : 0)} / ${cycle}`;
}

export function trafficUsage(node) {
  const up = Math.max(0, finite(node.totalUp)), down = Math.max(0, finite(node.totalDown));
  const type = String(node.trafficLimitType || "sum").toLowerCase();
  const used = type === "up" ? up : type === "down" ? down : type === "max" ? Math.max(up, down) : type === "min" ? Math.min(up, down) : up + down;
  return { used, type, limit: Math.max(0, finite(node.trafficLimit)), percent: node.trafficLimit > 0 ? clamp(used / node.trafficLimit * 100) : null };
}

export function parseAliases(text) {
  const aliases = new Map();
  String(text || "").split(/[;；\n]+/).forEach((entry) => {
    const [source, target] = entry.split(/[=＝]/).map((part) => part?.trim());
    if (source && target) aliases.set(source, target);
  });
  return aliases;
}

const COUNTRIES = [
  ["HK", "香港", ["hong kong", "hongkong", "香港"]],
  ["SG", "新加坡", ["singapore", "新加坡"]],
  ["JP", "日本", ["japan", "tokyo", "osaka", "日本", "东京", "東京", "大阪"]],
  ["DE", "德国", ["germany", "frankfurt", "德国", "德國", "法兰克福", "法蘭克福"]],
  ["FI", "芬兰", ["finland", "helsinki", "芬兰", "芬蘭", "赫尔辛基", "赫爾辛基"]],
  ["CN", "中国大陆", ["china", "mainland", "中国", "中國", "大陆", "大陸", "北京", "上海", "广州", "深圳"]],
  ["US", "美国", ["united states", "usa", "america", "los angeles", "new york", "san jose", "美国", "美國", "洛杉矶", "洛杉磯", "纽约", "紐約", "圣何塞", "聖何塞"]],
  ["TW", "中国台湾", ["taiwan", "taipei", "台湾", "臺灣", "台北", "臺北"]],
  ["KR", "韩国", ["south korea", "korea", "seoul", "韩国", "韓國", "首尔", "首爾"]],
  ["GB", "英国", ["united kingdom", "britain", "england", "london", "英国", "英國", "伦敦", "倫敦"]],
  ["FR", "法国", ["france", "paris", "法国", "法國", "巴黎"]],
  ["NL", "荷兰", ["netherlands", "amsterdam", "荷兰", "荷蘭", "阿姆斯特丹"]],
  ["CA", "加拿大", ["canada", "toronto", "vancouver", "加拿大", "多伦多", "多倫多", "温哥华", "溫哥華"]],
  ["AU", "澳大利亚", ["australia", "sydney", "melbourne", "澳大利亚", "澳大利亞", "澳洲", "悉尼", "墨尔本", "墨爾本"]],
  ["RU", "俄罗斯", ["russia", "moscow", "俄罗斯", "俄羅斯", "莫斯科"]],
  ["IN", "印度", ["india", "mumbai", "印度", "孟买", "孟買"]],
  ["VN", "越南", ["vietnam", "越南", "河内", "河內", "胡志明"]],
  ["TH", "泰国", ["thailand", "bangkok", "泰国", "泰國", "曼谷"]],
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map(([code, name, aliases]) => [code, { code, name, aliases }]));

function emojiToCode(value) {
  const match = String(value || "").match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (!match) return "";
  return [...match[0]].map((symbol) => String.fromCharCode(symbol.codePointAt(0) - 0x1f1e6 + 65)).join("");
}

function codeToFlag(code) {
  return /^[A-Z]{2}$/.test(code) ? [...code].map((letter) => String.fromCodePoint(letter.charCodeAt(0) + 0x1f1e6 - 65)).join("") : "🌐";
}

export function countryIdentity(value) {
  const raw = String(value || "").trim();
  let code = emojiToCode(raw);
  if (!code) {
    const token = raw.toUpperCase().match(/(?:^|[^A-Z])([A-Z]{2})(?=$|[^A-Z])/);
    if (token && COUNTRY_BY_CODE.has(token[1])) code = token[1];
  }
  if (!code) {
    const normalized = raw.toLocaleLowerCase("en-US");
    const found = COUNTRIES.find(([, , aliases]) => aliases.some((alias) => normalized.includes(alias)));
    if (found) code = found[0];
  }
  const country = COUNTRY_BY_CODE.get(code);
  return country
    ? { code, flag: codeToFlag(code), name: country.name, raw }
    : { code: "--", flag: "🌐", name: raw || "未知地区", raw };
}
