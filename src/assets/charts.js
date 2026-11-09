import { escapeHtml } from "./format.js";

function points(values, width = 720, height = 180, max = null) {
  const clean = values.map((value) => Number.isFinite(Number(value)) ? Number(value) : null);
  const cap = max || Math.max(1, ...clean.filter(Number.isFinite));
  return clean.map((value, index) => {
    if (value === null) return null;
    const x = clean.length <= 1 ? 0 : index / (clean.length - 1) * width;
    const y = height - Math.min(1, Math.max(0, value / cap)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).filter(Boolean).join(" ");
}

export function lineChart(series, options = {}) {
  const width = 720, height = 180;
  const entries = series.filter((item) => Array.isArray(item.values) && item.values.length);
  const all = entries.flatMap((item) => item.values).filter(Number.isFinite);
  const max = options.max || Math.max(1, ...all) * 1.08;
  const lines = entries.map((item, index) => `<polyline points="${points(item.values, width, height, max)}" fill="none" stroke="${item.color || ["#d34a43", "#91b7bd", "#d5b36a"][index]}" stroke-width="${index ? 2 : 3}" vector-effect="non-scaling-stroke" />`).join("");
  const legend = entries.map((item) => `<span><i style="--series:${item.color || "#d34a43"}"></i>${escapeHtml(item.label)}</span>`).join("");
  return `<div class="chart-shell"><div class="chart-legend">${legend}<b>${escapeHtml(options.unit || "%")}</b></div><svg class="history-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(options.label || "历史趋势")}"><path class="chart-grid" d="M0 45H720 M0 90H720 M0 135H720"/>${lines}</svg></div>`;
}
