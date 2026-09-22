import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/specialists/index.ts
var specialists_exports = {};
__export(specialists_exports, {
  API_TOOLS: () => API_TOOLS,
  DATA_TOOLS: () => DATA_TOOLS,
  DEV_TOOLS: () => DEV_TOOLS,
  DOCS_TOOLS: () => DOCS_TOOLS,
  DOMAINS: () => DOMAINS,
  FRONTEND_TOOLS: () => FRONTEND_TOOLS,
  GROWTH_TOOLS: () => GROWTH_TOOLS,
  OPS_TOOLS: () => OPS_TOOLS,
  SECURITY_TOOLS: () => SECURITY_TOOLS,
  SPECIALISTS: () => SPECIALISTS,
  TOOLS: () => TOOLS,
  abTest: () => abTest,
  area: () => area,
  backoffSchedule: () => backoffSchedule,
  bool: () => bool,
  capacityHeadroom: () => capacityHeadroom,
  checkIdempotencyKey: () => checkIdempotencyKey,
  compareSemver: () => compareSemver,
  contrastRatio: () => contrastRatio,
  cspAudit: () => cspAudit,
  deployRisk: () => deployRisk,
  findSpecialist: () => findSpecialist,
  flag: () => flag,
  funnel: () => funnel,
  growthModel: () => growthModel,
  headingLint: () => headingLint,
  hslToRgb: () => hslToRgb,
  httpSemantics: () => httpSemantics,
  incidentSeverity: () => incidentSeverity,
  inr: () => inr,
  jwtInspect: () => jwtInspect,
  lintCommit: () => lintCommit,
  maskSecret: () => maskSecret,
  mean: () => mean,
  nextVersion: () => nextVersion,
  normalTwoSidedP: () => normalTwoSidedP,
  num: () => num,
  number: () => number,
  outliersIqr: () => outliersIqr,
  paginationPlan: () => paginationPlan,
  parseColor: () => parseColor,
  parseCron: () => parseCron,
  parseSemver: () => parseSemver,
  payloadBudget: () => payloadBudget,
  pct: () => pct,
  percentile: () => percentile,
  percentiles: () => percentiles,
  readability: () => readability,
  readingTime: () => readingTime,
  relativeLuminance: () => relativeLuminance,
  rgbToHsl: () => rgbToHsl,
  riceScore: () => riceScore,
  rows: () => rows,
  sampleSize: () => sampleSize,
  satisfiesRange: () => satisfiesRange,
  scanSecrets: () => scanSecrets,
  sel: () => sel,
  series: () => series,
  sloErrorBudget: () => sloErrorBudget,
  snapToGrid: () => snapToGrid,
  spacingGrid: () => spacingGrid,
  specialistStatus: () => specialistStatus,
  specialistsByDomain: () => specialistsByDomain,
  stddev: () => stddev,
  str: () => str,
  stringEntropyBits: () => stringEntropyBits,
  syllables: () => syllables,
  terminologyDrift: () => terminologyDrift,
  text: () => text,
  toHex: () => toHex,
  tokenBucketPlan: () => tokenBucketPlan,
  toolById: () => toolById,
  toolsForDomain: () => toolsForDomain,
  typeScale: () => typeScale,
  unitEconomics: () => unitEconomics,
  wcagVerdict: () => wcagVerdict
});

// src/specialists/types.ts
var text = (key2, label, def = "", hint) => ({ key: key2, label, kind: "text", def, ...hint ? { hint } : {} });
var num = (key2, label, def, hint) => ({ key: key2, label, kind: "number", def, ...hint ? { hint } : {} });
var area = (key2, label, def = "", hint) => ({ key: key2, label, kind: "textarea", def, ...hint ? { hint } : {} });
var sel = (key2, label, options, def, hint) => ({ key: key2, label, kind: "select", options, def: def ?? options[0] ?? "", ...hint ? { hint } : {} });
var flag = (key2, label, def, hint) => ({ key: key2, label, kind: "toggle", def, ...hint ? { hint } : {} });
var str = (v, key2, fallback = "") => {
  const x = v[key2];
  return typeof x === "string" ? x : typeof x === "boolean" ? String(x) : fallback;
};
var bool = (v, key2, fallback = false) => {
  const x = v[key2];
  return typeof x === "boolean" ? x : typeof x === "string" ? x === "true" : fallback;
};
var number = (v, key2, fallback = 0) => {
  const raw = str(v, key2).replace(/[,\s_₹%]/g, "");
  const n2 = Number(raw);
  return Number.isFinite(n2) ? n2 : fallback;
};
var rows = (v, key2) => str(v, key2).split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));
var series = (v, key2) => rows(v, key2).flatMap((l) => l.split(/[,\s;]+/)).map((c) => Number(c)).filter((x) => Number.isFinite(x));
var inr = (n2, dp = 2) => `\u20B9${n2.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
var pct = (n2, dp = 1) => `${n2.toFixed(dp)}%`;

// src/specialists/frontend.ts
function parseColor(input) {
  const s = input.trim().toLowerCase();
  const hex = s.match(/^#?([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const [r, g, b, a] = h.split("");
      return {
        r: parseInt(`${r}${r}`, 16),
        g: parseInt(`${g}${g}`, 16),
        b: parseInt(`${b}${b}`, 16),
        a: a === void 0 ? 1 : parseInt(`${a}${a}`, 16) / 255
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      };
    }
    return null;
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const p = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.slice(0, 3).some((x) => !Number.isFinite(x))) return null;
    return { r: clamp255(p[0]), g: clamp255(p[1]), b: clamp255(p[2]), a: p[3] ?? 1 };
  }
  const hsl = s.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) {
    const p = hsl[1].split(/[\s,/]+/).filter(Boolean);
    const h = Number(p[0]), sat = parseFloat(p[1] ?? "0"), l = parseFloat(p[2] ?? "0");
    if (!Number.isFinite(h) || !Number.isFinite(sat) || !Number.isFinite(l)) return null;
    const { r, g, b } = hslToRgb(h, sat / 100, l / 100);
    return { r, g, b, a: p[3] !== void 0 ? Number(p[3]) : 1 };
  }
  return null;
}
var clamp255 = (n2) => Math.max(0, Math.min(255, Math.round(n2)));
function hslToRgb(h, s, l) {
  const hue = (h % 360 + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(hue / 60 % 2 - 1));
  const m = l - c / 2;
  const seg = Math.floor(hue / 60) % 6;
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][seg];
  return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) };
}
function rgbToHsl({ r, g, b }) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === rr ? 60 * ((gg - bb) / d % 6) : max === gg ? 60 * ((bb - rr) / d + 2) : 60 * ((rr - gg) / d + 4);
  return { h: (h % 360 + 360) % 360, s: s * 100, l: l * 100 };
}
var toHex = (c) => `#${[c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, "0")).join("")}` + (c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, "0") : "");
function relativeLuminance(c) {
  const f2 = (v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f2(c.r) + 0.7152 * f2(c.g) + 0.0722 * f2(c.b);
}
function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function wcagVerdict(ratio) {
  const aaNormal = ratio >= 4.5, aaLarge = ratio >= 3, aaaNormal = ratio >= 7, aaaLarge = ratio >= 4.5;
  const guidance = aaaNormal ? "passes AAA for body text as well as AA" : aaNormal ? "passes AA for body text; AAA (7:1) is not met \u2014 acceptable for everything except the strictest briefs" : aaLarge ? "passes AA for LARGE text only (18.66px bold or 24px+): do not use this pair for body copy" : "fails every threshold \u2014 increase the luminance gap";
  return { ratio, aaNormal, aaLarge, aaaNormal, aaaLarge, guidance };
}
function typeScale(base, ratio, steps) {
  const NAMES = ["-1", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];
  const out = [];
  let previous = Math.round(base / ratio * 4) / 4;
  for (let i = -1; i < steps - 1; i++) {
    const raw = i === -1 ? base / ratio : previous * ratio;
    const px = Math.round(raw * 4) / 4;
    out.push({ step: i, px, rem: Math.round(px / 16 * 1e3) / 1e3, name: NAMES[i + 1] ?? `step${i}` });
    previous = px;
  }
  return out;
}
function spacingGrid(base, count) {
  return Array.from({ length: count + 1 }, (_, i) => i * base);
}
function snapToGrid(values, base) {
  const mapped = values.map((v) => {
    const snapped = Math.round(v / base) * base;
    return { value: v, snapped, moved: Math.round((snapped - v) * 100) / 100 };
  });
  const moved = mapped.map((m) => Math.abs(m.moved));
  return {
    rows: mapped,
    worst: moved.length ? Math.max(...moved) : 0,
    onGrid: mapped.filter((m) => m.moved === 0).length
  };
}
var FRONTEND_TOOLS = [
  {
    id: "contrast",
    domain: "frontend",
    label: "Contrast",
    blurb: "WCAG 2.x contrast ratio for a foreground/background pair, and what it passes.",
    fields: [
      text("fg", "Text colour", "#8A9BA8", "hex, rgb() or hsl()"),
      text("bg", "Background", "#0E1113"),
      sel("size", "Text size", ["body", "large"], "body", "large = 24px+, or 18.66px bold")
    ],
    run: (v) => {
      const fg = parseColor(str(v, "fg")), bg = parseColor(str(v, "bg"));
      if (!fg || !bg) {
        return {
          headline: "One of those is not a colour this engine can read",
          ok: false,
          basis: "accepted forms: #rgb \xB7 #rrggbb \xB7 #rrggbbaa \xB7 rgb()/rgba() \xB7 hsl()/hsla() \u2014 an unreadable value is refused rather than approximated"
        };
      }
      const ratio = contrastRatio(fg, bg);
      const verdict = wcagVerdict(ratio);
      const large = str(v, "size") === "large";
      const passesNow = large ? verdict.aaLarge : verdict.aaNormal;
      return {
        headline: `${ratio.toFixed(2)}:1 \u2014 ${passesNow ? "passes" : "fails"} AA for ${large ? "large" : "body"} text`,
        ok: passesNow,
        kpis: [
          { value: `${ratio.toFixed(2)}:1`, label: "contrast ratio" },
          { value: verdict.aaaNormal ? "AAA" : verdict.aaNormal ? "AA" : verdict.aaLarge ? "AA large" : "fail", label: "highest level met" },
          { value: toHex(fg), label: "text" },
          { value: toHex(bg), label: "background" }
        ],
        lines: [verdict.guidance],
        basis: "WCAG 2.1 SC 1.4.3 / 1.4.6 \u2014 relative luminance per WCAG, ratio = (L1+0.05)/(L2+0.05); AA 4.5:1 body and 3:1 large, AAA 7:1 body and 4.5:1 large"
      };
    }
  },
  {
    id: "colour",
    domain: "frontend",
    label: "Colour convert",
    blurb: "One colour in every notation a codebase, a design file and a runtime need.",
    fields: [text("c", "Colour", "#D5B26B")],
    run: (v) => {
      const c = parseColor(str(v, "c"));
      if (!c) return {
        headline: "Not a colour this engine can read",
        ok: false,
        basis: "#rgb \xB7 #rrggbb \xB7 #rrggbbaa \xB7 rgb() \xB7 rgba() \xB7 hsl() \xB7 hsla()"
      };
      const hsl = rgbToHsl(c);
      return {
        headline: toHex(c),
        ok: true,
        kpis: [
          { value: toHex(c), label: "hex" },
          { value: `rgb(${c.r}, ${c.g}, ${c.b})`, label: "rgb" },
          { value: `hsl(${hsl.h.toFixed(0)}, ${hsl.s.toFixed(0)}%, ${hsl.l.toFixed(0)}%)`, label: "hsl" },
          { value: c.a.toFixed(2), label: "alpha" }
        ],
        lines: [`On white: ${contrastRatio(c, { r: 255, g: 255, b: 255, a: 1 }).toFixed(2)}:1 \xB7 on black: ${contrastRatio(c, { r: 0, g: 0, b: 0, a: 1 }).toFixed(2)}:1`],
        basis: "sRGB conversion, alpha preserved from an 8-digit hex or an rgba()/hsla() argument"
      };
    }
  },
  {
    id: "type-scale",
    domain: "frontend",
    label: "Type scale",
    blurb: "A modular type scale in px and rem, rounded the way a designer writes it.",
    fields: [
      num("base", "Base size (px)", "16"),
      sel("ratio", "Ratio", ["1.125", "1.2", "1.25", "1.333", "1.414", "1.5", "1.618"], "1.25"),
      num("steps", "Steps", "6")
    ],
    run: (v) => {
      const base = number(v, "base", 16), ratio = Number(str(v, "ratio")) || 1.25;
      const steps = Math.max(2, Math.min(9, Math.round(number(v, "steps", 6))));
      const scale2 = typeScale(base, ratio, steps);
      return {
        headline: `${base}px \xD7 ${ratio} \u2014 ${scale2.length} steps`,
        ok: true,
        table: { head: ["Step", "Name", "px", "rem"], rows: scale2.map((s) => [String(s.step), s.name, `${s.px}`, `${s.rem}`]) },
        lines: [`Smallest ${scale2[0].px}px \xB7 largest ${scale2[scale2.length - 1].px}px. Rounding is to a quarter pixel and each step compounds the ROUNDED value, so the scale matches the numbers in the code.`],
        basis: "modular scale, ratio applied per step; rem assumes a 16px root"
      };
    }
  },
  {
    id: "spacing",
    domain: "frontend",
    label: "Spacing grid",
    blurb: "Snaps a list of spacing values to a base grid and reports how far each one moved.",
    fields: [
      num("base", "Grid base (px)", "8"),
      num("count", "Scale steps", "8"),
      text("values", "Values to snap", "4, 10, 16, 24, 30, 40, 55", "comma or newline separated")
    ],
    run: (v) => {
      const base = number(v, "base", 8);
      const grid = spacingGrid(base, Math.max(1, Math.min(20, Math.round(number(v, "count", 8)))));
      const values = str(v, "values").split(/[,\s;]+/).map(Number).filter((x) => Number.isFinite(x));
      const snapped = snapToGrid(values, base);
      const bad = snapped.rows.filter((r) => r.moved !== 0);
      return {
        headline: `${snapped.onGrid}/${snapped.rows.length} values already on the ${base}px grid`,
        ok: bad.length === 0,
        kpis: [
          { value: `${base}px`, label: "grid base" },
          { value: `${grid[grid.length - 1]}px`, label: `top of the ${grid.length - 1}-step scale` },
          { value: bad.length ? `${snapped.worst}px` : "\u2014", label: "largest snap" }
        ],
        table: snapped.rows.length ? { head: ["Value", "Snapped", "Moved"], rows: snapped.rows.map((r) => [`${r.value}`, `${r.snapped}`, r.moved === 0 ? "\u2014" : `${r.moved > 0 ? "+" : ""}${r.moved}`]) } : void 0,
        lines: bad.length ? [`${bad.length} value(s) are off-grid. The largest moves ${snapped.worst}px onto the grid.`] : ["Every value is already on the grid \u2014 the scale is internally consistent."],
        basis: `nearest multiple of ${base}px; a grid is a constraint, and the tool reports the movement rather than pretending the values were always aligned`
      };
    }
  }
];

// src/specialists/dev.ts
function parseSemver(input) {
  const m = input.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split(".") : [],
    raw: input.trim()
  };
}
function compareSemver(a, b) {
  for (const k of ["major", "minor", "patch"]) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  }
  if (a.pre.length === 0 && b.pre.length === 0) return 0;
  if (a.pre.length === 0) return 1;
  if (b.pre.length === 0) return -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i];
    if (x === void 0) return -1;
    if (y === void 0) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
      continue;
    }
    if (nx !== ny) return nx ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
function satisfiesRange(version, range) {
  const sets = range.split("||").map((r) => r.trim());
  const expanded = [];
  for (const set of sets) {
    const parts = set.split(/\s+/).filter(Boolean);
    let ok2 = true;
    for (const part of parts) {
      const bounds = boundFor(part.trim());
      expanded.push(`${part} \u2192 ${bounds}`);
      ok2 = ok2 && within(version, part.trim());
    }
    if (ok2) return { ok: true, expanded };
  }
  return { ok: false, expanded };
}
function boundFor(range) {
  if (range.startsWith("^")) {
    const b = parseSemver(range.slice(1));
    if (!b) return "unparseable";
    const upper = b.major > 0 ? `${b.major + 1}.0.0` : b.minor > 0 ? `0.${b.minor + 1}.0` : `0.0.${b.patch + 1}`;
    return `>=${b.major}.${b.minor}.${b.patch} <${upper}`;
  }
  if (range.startsWith("~")) {
    const b = parseSemver(range.slice(1));
    if (!b) return "unparseable";
    return `>=${b.major}.${b.minor}.${b.patch} <${b.major}.${b.minor + 1}.0`;
  }
  return range;
}
function within(v, range) {
  const cmp = (a, b) => compareSemver(a, b);
  if (range === "*" || range === "" || range.toLowerCase() === "latest") return true;
  let m;
  if (m = range.match(/^([\^~]?)(\d+)\.(\d+)\.(\d+)$/)) {
    const b = parseSemver(`${m[2]}.${m[3]}.${m[4]}`);
    if (m[1] === "^") {
      if (v.major !== b.major) return false;
      return b.major > 0 ? true : v.minor === b.minor && cmp(v, b) >= 0;
    }
    if (m[1] === "~") return v.major === b.major && v.minor === b.minor && cmp(v, b) >= 0;
    return cmp(v, b) === 0;
  }
  if (m = range.match(/^(>=|<=|>|<)\s*v?(\d+)\.(\d+)\.(\d+)$/)) {
    const b = parseSemver(`${m[2]}.${m[3]}.${m[4]}`);
    const c = cmp(v, b);
    return m[1] === ">=" ? c >= 0 : m[1] === "<=" ? c <= 0 : m[1] === ">" ? c > 0 : c < 0;
  }
  if ((m = range.match(/^(\d+)\.(\d+)\.[xX*]$/)) || (m = range.match(/^(\d+)\.[xX*]$/))) {
    return v.major === Number(m[1]) && (m.length === 2 || v.minor === Number(m[2]));
  }
  return false;
}
function nextVersion(v, kind) {
  switch (kind) {
    case "major":
      return `${v.major + 1}.0.0`;
    case "minor":
      return `${v.major}.${v.minor + 1}.0`;
    case "patch":
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    case "prerelease": {
      const last = v.pre[v.pre.length - 1];
      const n2 = last && /^\d+$/.test(last) ? Number(last) + 1 : 0;
      const head = last && /^\d+$/.test(last) ? v.pre.slice(0, -1) : v.pre;
      const pre = head.length ? head : ["rc"];
      return `${v.major}.${v.minor}.${v.patch}-${[...pre, n2].join(".")}`;
    }
    case "release":
      return `${v.major}.${v.minor}.${v.patch}`;
  }
}
var COMMIT_TYPES = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"];
function lintCommit(message) {
  const lines = message.split(/\r?\n/);
  const subject = (lines[0] ?? "").trim();
  const errors = [], warnings = [];
  const m = subject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s(.+)$/);
  let type = null, scope = null, breaking = false;
  if (!m) {
    errors.push("subject does not match `type(scope): description` \u2014 no changelog or release tool can parse this");
  } else {
    type = m[1];
    scope = m[2] ?? null;
    breaking = Boolean(m[3]);
    if (!COMMIT_TYPES.includes(type)) errors.push(`type "${type}" is not a conventional type (${COMMIT_TYPES.join(", ")})`);
    const desc = m[4];
    if (desc.length > 72) errors.push(`description is ${desc.length} characters \u2014 72 is the limit most tools truncate at`);
    if (desc.endsWith(".")) warnings.push("the description ends with a full stop; the convention leaves it off");
    if (/^[A-Z]/.test(desc)) warnings.push("the description starts with a capital; the convention is lower case");
    if (desc.split(/\s+/).length < 2) warnings.push("one-word descriptions make an unreadable changelog");
  }
  const body = lines.slice(1);
  if (body.length > 0 && (body[0] ?? "").trim() !== "") {
    errors.push("the second line must be blank \u2014 a body glued to the subject is the classic parse failure");
  }
  if (body.some((l) => /^BREAKING CHANGE:/.test(l))) breaking = true;
  if (breaking && !subject.match(/^[a-z]+(\([^)]+\))?!:/) && !body.some((l) => /^BREAKING CHANGE:/.test(l))) {
    warnings.push("marked breaking without the `!` or a BREAKING CHANGE footer");
  }
  return { subject, type, scope, breaking, errors, warnings };
}
var HTTP = Object.freeze({
  200: { name: "OK", retry: "no", note: "success" },
  201: { name: "Created", retry: "no", note: "the Location header should carry the new resource" },
  202: { name: "Accepted", retry: "no", note: "work queued \u2014 poll the status resource, do not re-POST" },
  204: { name: "No Content", retry: "no", note: "success with an empty body; do not parse it as JSON" },
  301: { name: "Moved Permanently", retry: "no", note: "a client should cache the redirect; API clients should be updated" },
  304: { name: "Not Modified", retry: "no", note: "conditional GET succeeded without a body" },
  400: { name: "Bad Request", retry: "no", note: "the request is malformed \u2014 retrying sends the same malformed request" },
  401: { name: "Unauthorized", retry: "maybe", note: "refresh the credential ONCE, then stop" },
  403: { name: "Forbidden", retry: "no", note: "authenticated but not permitted \u2014 a retry cannot fix it" },
  404: { name: "Not Found", retry: "no", note: "in a retry loop this usually means a wrong identifier" },
  405: { name: "Method Not Allowed", retry: "no", note: "the Allow header names the permitted methods" },
  409: { name: "Conflict", retry: "maybe", note: "a concurrent write lost \u2014 re-read and decide, do not blind-retry" },
  410: { name: "Gone", retry: "no", note: "deliberately absent; stop asking" },
  412: { name: "Precondition Failed", retry: "no", note: "an If-Match/If-Unmodified-Since guard rejected the write" },
  422: { name: "Unprocessable Content", retry: "no", note: "well-formed but semantically rejected \u2014 the body explains why" },
  425: { name: "Too Early", retry: "yes", note: "the server refused a replay \u2014 safe to retry after a delay" },
  429: { name: "Too Many Requests", retry: "yes", note: "honour Retry-After; exponential backoff without it is guesswork" },
  500: { name: "Internal Server Error", retry: "yes", note: "the classic retryable failure" },
  502: { name: "Bad Gateway", retry: "yes", note: "upstream failed \u2014 retry with backoff and a cap" },
  503: { name: "Service Unavailable", retry: "yes", note: "honour Retry-After; this is what load shedding looks like" },
  504: { name: "Gateway Timeout", retry: "yes", note: "the work may have COMPLETED \u2014 only retry an idempotent operation" }
});
function httpSemantics(code) {
  const entry = HTTP[code];
  const klass = code >= 100 && code < 200 ? "informational" : code < 300 ? "success" : code < 400 ? "redirect" : code < 500 ? "client error" : code < 600 ? "server error" : "not a status code";
  if (!entry) {
    return {
      known: false,
      klass,
      retry: "unknown",
      idempotentSafe: "\u2014",
      note: "not a code this engine carries \u2014 treat an unrecognised status as unclassified rather than guessing"
    };
  }
  const idempotentSafe = code < 500 ? "a retry changes nothing only if the request was idempotent (GET/PUT/DELETE/HEAD)" : "retry is safe only for an idempotent request or with an idempotency key";
  return { known: true, klass, retry: entry.retry, idempotentSafe, note: entry.note };
}
function backoffSchedule(attempts, baseMs, factor, capMs, jitterPermille = 0) {
  const out = [];
  let cumulative = 0;
  for (let i = 1; i <= Math.max(1, Math.min(30, attempts)); i++) {
    const raw = Math.min(capMs, baseMs * Math.pow(factor, i - 1));
    const jittered = Math.round(raw * (1 + jitterPermille * (i % 3 - 1) / 1e3));
    const delayMs = Math.max(0, Math.min(capMs, jittered));
    cumulative += delayMs;
    out.push({ attempt: i, delayMs, cumulativeMs: cumulative });
  }
  const human = cumulative < 6e4 ? `${(cumulative / 1e3).toFixed(1)}s` : `${(cumulative / 6e4).toFixed(1)} minutes`;
  return { rows: out, totalMs: cumulative, human };
}
var CRON_FIELDS = [
  { name: "minute", min: 0, max: 59 },
  { name: "hour", min: 0, max: 23 },
  { name: "day-of-month", min: 1, max: 31 },
  { name: "month", min: 1, max: 12 },
  { name: "day-of-week", min: 0, max: 6 }
];
function fieldSet(expr, min, max, name, errors) {
  const set = /* @__PURE__ */ new Set();
  for (const part of expr.split(",")) {
    const stepMatch = part.match(/^(\*|\d+(?:-\d+)?)\/(\d+)$/);
    const base = stepMatch ? stepMatch[1] : part;
    const step = stepMatch ? Number(stepMatch[2]) : 1;
    let from = min, to = max;
    if (base !== "*") {
      const r = base.match(/^(\d+)(?:-(\d+))?$/);
      if (!r) {
        errors.push(`${name}: "${part}" is not a value, range, list or step`);
        return null;
      }
      from = Number(r[1]);
      to = r[2] !== void 0 ? Number(r[2]) : stepMatch ? max : from;
    }
    if (from < min || to > max || from > to) {
      errors.push(`${name}: ${from}-${to} is outside ${min}-${max}`);
      return null;
    }
    if (step < 1) {
      errors.push(`${name}: step must be at least 1`);
      return null;
    }
    for (let i = from; i <= to; i += step) set.add(i);
  }
  return set;
}
function parseCron(expr, fromIso, count = 5) {
  const errors = [];
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      valid: false,
      fields: [],
      next: [],
      errors: [`${parts.length} fields \u2014 cron takes exactly 5 (minute hour day-of-month month day-of-week); a 6-field expression with seconds is a different dialect`]
    };
  }
  const sets = CRON_FIELDS.map((f2, i) => fieldSet(parts[i], f2.min, f2.max, f2.name, errors));
  if (errors.length > 0 || sets.some((s) => s === null)) return { valid: false, errors, fields: [], next: [] };
  const [min, hr, dom, mon, dow] = sets;
  const start = /* @__PURE__ */ new Date(`${fromIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return { valid: false, errors: [`"${fromIso}" is not an ISO date`], fields: [], next: [] };
  const next = [];
  const cursor = new Date(start.getTime());
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit && next.length < count; i++) {
    const dayRestricted = parts[2].trim() !== "*";
    const dowRestricted = parts[4].trim() !== "*";
    const dayMatch = dayRestricted && dowRestricted ? dom.has(cursor.getUTCDate()) || dow.has(cursor.getUTCDay()) : dom.has(cursor.getUTCDate()) && dow.has(cursor.getUTCDay());
    if (min.has(cursor.getUTCMinutes()) && hr.has(cursor.getUTCHours()) && mon.has(cursor.getUTCMonth() + 1) && dayMatch) {
      next.push(cursor.toISOString().slice(0, 16).replace("T", " "));
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return { valid: true, errors: [], fields: parts, next };
}
var DEV_TOOLS = [
  {
    id: "semver",
    domain: "dev",
    label: "SemVer",
    blurb: "Compare two versions, expand a range into the bounds it really means, bump correctly.",
    fields: [
      text("version", "Version", "1.4.2-rc.3"),
      text("range", "Range to test", "^1.2.0", "exact \xB7 ^ \xB7 ~ \xB7 >= \xB7 x-range \xB7 hyphen \xB7 || unions"),
      sel("bump", "If bumping", ["patch", "minor", "major", "prerelease", "release"], "patch")
    ],
    run: (v) => {
      const ver = parseSemver(str(v, "version"));
      if (!ver) return {
        headline: "That is not a semantic version this engine accepts",
        ok: false,
        basis: "expected MAJOR.MINOR.PATCH with optional -prerelease and +build, an optional leading v"
      };
      const range = str(v, "range");
      const sat = satisfiesRange(ver, range);
      const bumpKind = str(v, "bump");
      return {
        headline: `${ver.raw} ${sat.ok ? "satisfies" : "does NOT satisfy"} ${range}`,
        ok: sat.ok,
        kpis: [
          { value: `${ver.major}.${ver.minor}.${ver.patch}`, label: "core" },
          { value: ver.pre.length ? ver.pre.join(".") : "\u2014", label: "prerelease" },
          { value: nextVersion(ver, bumpKind), label: `bump ${bumpKind}` }
        ],
        table: sat.expanded.length ? { head: ["Term", "Expands to"], rows: sat.expanded.map((e) => {
          const [term, bounds] = e.split(" \u2192 ");
          return [term ?? "", bounds ?? ""];
        }) } : void 0,
        lines: [
          sat.ok ? "The version is inside the declared range." : "The version is outside the range \u2014 check whether the range or the version is the stale one.",
          ver.pre.length ? "A prerelease sorts BELOW its own release: 1.4.2-rc.3 < 1.4.2. Caret and tilde ranges do not admit prereleases unless the range itself names one." : "No prerelease, so ordinary precedence applies."
        ],
        basis: "SemVer 2.0.0 precedence; ranges expanded to explicit bounds so the answer is checkable rather than asserted"
      };
    }
  },
  {
    id: "commit",
    domain: "dev",
    label: "Commit lint",
    blurb: "Lints a commit message the way the changelog generator will read it.",
    fields: [area("msg", "Message", "feat(auth): add device-bound session keys\n\nSessions are now bound to a device key at issue time.", "the whole message, subject and body")],
    run: (v) => {
      const msg = str(v, "msg");
      if (!msg.trim()) return { headline: "Nothing to lint", ok: false, basis: "paste a full commit message, including the body" };
      const l = lintCommit(msg);
      return {
        headline: l.errors.length === 0 ? `Clean \u2014 ${l.type}${l.scope ? `(${l.scope})` : ""}` : `${l.errors.length} error(s)`,
        ok: l.errors.length === 0,
        kpis: [
          { value: l.type ?? "\u2014", label: "type" },
          { value: l.scope ?? "\u2014", label: "scope" },
          { value: l.breaking ? "yes" : "no", label: "breaking" },
          { value: `${l.subject.length}`, label: "subject chars" }
        ],
        lines: [...l.errors.map((e) => `ERROR \u2014 ${e}`), ...l.warnings.map((w) => `warning \u2014 ${w}`)],
        basis: "Conventional Commits 1.0.0: `type(scope): description`, a blank second line, and a BREAKING CHANGE footer or `!` for a breaking change"
      };
    }
  },
  {
    id: "http",
    domain: "dev",
    label: "HTTP status",
    blurb: "What a status code means for a retry loop \u2014 and whether retrying is safe at all.",
    fields: [num("code", "Status code", "429")],
    run: (v) => {
      const code = Math.round(number(v, "code", 429));
      const s = httpSemantics(code);
      return {
        headline: `${code} ${s.known ? "" : "(unclassified)"} \u2014 retry: ${s.retry}`,
        ok: s.known && s.retry !== "no",
        kpis: [
          { value: s.klass, label: "class" },
          { value: s.retry, label: "retry?" }
        ],
        lines: [s.note, `Idempotence \u2014 ${s.idempotentSafe}`],
        basis: "HTTP semantics (RFC 9110) plus the retry conventions that follow from them; 504 is the one that looks like a failure and may not be one"
      };
    }
  },
  {
    id: "backoff",
    domain: "dev",
    label: "Retry ladder",
    blurb: "The schedule a retry loop actually produces, and how long it takes to give up.",
    fields: [
      num("attempts", "Attempts", "6"),
      num("base", "Base delay (ms)", "200"),
      num("factor", "Factor", "2"),
      num("cap", "Cap (ms)", "30000"),
      num("jitter", "Jitter (\xB1\u2030)", "0", "a fixed permille, so the schedule is reproducible")
    ],
    run: (v) => {
      const s = backoffSchedule(
        Math.round(number(v, "attempts", 6)),
        number(v, "base", 200),
        number(v, "factor", 2) || 2,
        number(v, "cap", 3e4),
        Math.round(number(v, "jitter", 0))
      );
      const last = s.rows[s.rows.length - 1];
      return {
        headline: `${s.rows.length} attempts, ${s.human} before the last one is sent`,
        ok: true,
        kpis: [
          { value: s.human, label: "total elapsed" },
          { value: `${last?.delayMs ?? 0}ms`, label: "final delay" },
          { value: s.rows.some((r) => r.delayMs === Math.round(number(v, "cap", 3e4))) ? "capped" : "uncapped", label: "cap" }
        ],
        table: { head: ["Attempt", "Delay (ms)", "Cumulative (ms)"], rows: s.rows.map((r) => [`${r.attempt}`, `${r.delayMs}`, `${r.cumulativeMs}`]) },
        lines: ["A ladder that exceeds the caller's own timeout is a ladder nobody finishes climbing \u2014 compare the total above with the timeout on the client."],
        basis: "exponential backoff with a cap; jitter is shown as a fixed permille so the schedule is reproducible and pinnable \u2014 real jitter is applied at runtime on top of this shape"
      };
    }
  },
  {
    id: "cron",
    domain: "dev",
    label: "Cron",
    blurb: "Validates a 5-field cron expression and shows the next runs \u2014 including the day-field oddity.",
    fields: [
      text("expr", "Expression", "0 3 * * 1"),
      text("from", "From (ISO date)", "2026-09-22"),
      num("count", "Runs to show", "5")
    ],
    run: (v) => {
      const r = parseCron(str(v, "expr"), str(v, "from"), Math.max(1, Math.min(20, Math.round(number(v, "count", 5)))));
      if (!r.valid) {
        return {
          headline: "Invalid expression",
          ok: false,
          lines: r.errors,
          basis: "5 fields: minute hour day-of-month month day-of-week (0 = Sunday)"
        };
      }
      return {
        headline: `Next ${r.next.length} run(s)`,
        ok: true,
        kpis: [
          { value: r.fields[0] ?? "", label: "minute" },
          { value: r.fields[1] ?? "", label: "hour" },
          { value: `${r.fields[2]} ${r.fields[3]} ${r.fields[4]}`, label: "dom \xB7 month \xB7 dow" }
        ],
        lines: r.next.map((n2) => `\xB7 ${n2} UTC`),
        code: r.next.join("\n"),
        basis: "standard 5-field cron interpreted in UTC; when BOTH day-of-month and day-of-week are restricted the job runs when EITHER matches \u2014 the rule that silently breaks weekly jobs"
      };
    }
  }
];

// src/specialists/api.ts
function tokenBucketPlan(ratePerMinute, burst, perSecond, seconds) {
  const refill = ratePerMinute / 60;
  let tokens = burst;
  const steps = [];
  let admitted = 0, rejected = 0, firstRejection = null;
  for (let s = 1; s <= seconds; s++) {
    tokens = Math.min(burst, tokens + refill);
    const take = Math.min(perSecond, Math.floor(tokens));
    if (take < perSecond && firstRejection === null) firstRejection = s;
    admitted += take;
    rejected += perSecond - take;
    tokens -= take;
    steps.push({ second: s, tokens: Math.round(tokens * 1e3) / 1e3, admitted: take, rejected: perSecond - take });
  }
  return {
    steps,
    admitted,
    rejected,
    firstRejection,
    steadyState: Math.min(perSecond, Math.floor(refill))
  };
}
function payloadBudget(json) {
  const trimmed = json.trim();
  if (!trimmed) return { ok: false, error: "nothing to measure", totalBytes: 0, fields: [], largest: null };
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, error: `not valid JSON \u2014 ${String(e)}`, totalBytes: new TextEncoder().encode(trimmed).length, fields: [], largest: null };
  }
  const totalBytes = new TextEncoder().encode(trimmed).length;
  const rows2 = [];
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    for (const [k, val] of Object.entries(parsed)) {
      const size = new TextEncoder().encode(`${JSON.stringify(k)}:${JSON.stringify(val)}`).length;
      rows2.push({ field: k, bytes: size, share: totalBytes ? size / totalBytes * 100 : 0 });
    }
  } else if (Array.isArray(parsed)) {
    const first = parsed[0];
    rows2.push({ field: "(array)", bytes: totalBytes, share: 100 });
    if (first && typeof first === "object" && !Array.isArray(first)) {
      for (const k of Object.keys(first)) {
        const size = new TextEncoder().encode(JSON.stringify(k)).length + 2;
        rows2.push({ field: `(item).${k}`, bytes: size, share: 0 });
      }
    }
  } else {
    rows2.push({ field: "(scalar)", bytes: totalBytes, share: 100 });
  }
  rows2.sort((a, b) => b.bytes - a.bytes);
  return { ok: true, totalBytes, fields: rows2, largest: rows2[0] ?? null };
}
function stringEntropyBits(s) {
  if (!s) return 0;
  const counts = /* @__PURE__ */ new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bitsPerChar = 0;
  for (const n2 of counts.values()) {
    const p = n2 / s.length;
    bitsPerChar -= p * Math.log2(p);
  }
  return bitsPerChar * s.length;
}
function checkIdempotencyKey(key2) {
  const issues = [];
  const k = key2.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(k);
  const isHex = /^[0-9a-f]{16,}$/i.test(k);
  const isB64 = /^[A-Za-z0-9_-]{22,}$/.test(k);
  const charset = isUuid ? "uuid" : isHex ? "hex" : isB64 ? "base64url" : "other";
  const entropyBits = Math.round(stringEntropyBits(k));
  if (k.length < 16) issues.push(`${k.length} characters \u2014 too short to be collision-resistant; 128 bits of randomness is the usual floor`);
  if (charset === "other") issues.push("unusual character set \u2014 prefer a UUIDv4 or 16+ random bytes in hex/base64url");
  if (/^(test|dev|dummy|123|abc)/i.test(k)) issues.push("looks sequential or human-authored; an idempotency key must not be guessable");
  if (entropyBits < 96) issues.push(`~${entropyBits} bits measured from its own character distribution \u2014 below the 96\u2013128 bit range a real random key lands in`);
  return { ok: issues.length === 0, length: k.length, charset, entropyBits, issues };
}
function paginationPlan(total, pageSize, offset = 0, deepOffsetLimit = 1e4) {
  if (pageSize <= 0) return { pages: 0, lastPageSize: 0, currentPage: 0, deep: false, lines: ["page size must be at least 1"] };
  const pages = Math.ceil(total / pageSize);
  const lastPageSize = total % pageSize === 0 ? pageSize : total % pageSize;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const deep = offset > deepOffsetLimit;
  return {
    pages,
    lastPageSize,
    currentPage,
    deep,
    lines: [
      `${total} rows at ${pageSize}/page = ${pages} pages; the last page carries ${total === 0 ? 0 : lastPageSize}.`,
      deep ? `Offset ${offset} is deep paging: the database still walks ${offset} rows to discard them. Prefer a keyset cursor (WHERE id > :last_id ORDER BY id LIMIT :n) \u2014 it is O(page size) instead of O(offset).` : `Offset paging is fine at this depth (${offset} rows skipped).`,
      `A cursor is also stable under writes; an offset is not \u2014 rows inserted while paging shift every later page.`
    ]
  };
}
var API_TOOLS = [
  {
    id: "rate-limit",
    domain: "api",
    label: "Rate limit",
    blurb: "Simulates a token bucket against a client's demand and shows the first 429.",
    fields: [
      num("rate", "Limit (requests / minute)", "600"),
      num("burst", "Burst allowance", "20"),
      num("demand", "Client demand (requests / second)", "15"),
      num("seconds", "Seconds to simulate", "30")
    ],
    run: (v) => {
      const rate = number(v, "rate", 600), burst = number(v, "burst", 20);
      const demand = Math.max(0, Math.round(number(v, "demand", 15)));
      const seconds = Math.max(1, Math.min(600, Math.round(number(v, "seconds", 30))));
      const plan = tokenBucketPlan(rate, burst, demand, seconds);
      const sustainable = plan.steadyState;
      const oversubscribed = demand > sustainable;
      return {
        headline: oversubscribed ? `Oversubscribed \u2014 ${demand}/s demanded against a sustainable ${sustainable}/s` : `Sustainable \u2014 ${demand}/s fits inside ${sustainable}/s`,
        ok: !oversubscribed,
        kpis: [
          { value: `${sustainable}/s`, label: "sustainable rate" },
          { value: plan.firstRejection === null ? "never" : `${plan.firstRejection}s`, label: "first rejection" },
          { value: `${plan.admitted}`, label: "admitted" },
          { value: `${plan.rejected}`, label: "rejected" }
        ],
        table: {
          head: ["Second", "Tokens", "Admitted", "Rejected"],
          rows: plan.steps.slice(0, 12).map((s) => [`${s.second}`, `${s.tokens}`, `${s.admitted}`, `${s.rejected}`])
        },
        lines: [
          oversubscribed ? `The burst absorbs the first ${plan.firstRejection ?? 0} second(s) and then the limit bites. A client that retries immediately on 429 makes this worse \u2014 honour Retry-After, or size the client below ${sustainable}/s.` : "Demand fits: the bucket refills faster than the client drains it, so a burst is absorbed and the steady state is never breached.",
          `Refill is ${(rate / 60).toFixed(2)} tokens/second \u2014 a limit expressed per minute is a per-SECOND refill, which is why the smoothing surprises people.`
        ],
        basis: "token bucket: capacity = burst, refill = limit/60 per second, whole requests only; deterministic simulation \u2014 no wall clock and no randomness, so a limit is reproducible and arguable"
      };
    }
  },
  {
    id: "payload",
    domain: "api",
    label: "Payload budget",
    blurb: "Measures a JSON response field by field and names what is making it big.",
    fields: [area("json", "JSON", '{"id":"acct_9f2","name":"Acme Industries","orders":[{"id":1},{"id":2}],"internal_notes":"a very long note that the client will never render but pays to download"}', "paste a response body")],
    run: (v) => {
      const b = payloadBudget(str(v, "json"));
      if (!b.ok) return { headline: "Could not measure that", ok: false, lines: b.error ? [b.error] : [], basis: "the payload must be valid JSON to be measured" };
      return {
        headline: `${b.totalBytes.toLocaleString()} bytes across ${b.fields.length} field(s)`,
        ok: b.totalBytes < 1e5,
        kpis: [
          { value: `${b.totalBytes.toLocaleString()} B`, label: "total" },
          { value: b.largest ? `${b.largest.share.toFixed(0)}%` : "\u2014", label: "largest share" },
          { value: b.largest?.field ?? "\u2014", label: "largest field" }
        ],
        table: { head: ["Field", "Bytes", "Share"], rows: b.fields.slice(0, 12).map((f2) => [f2.field, `${f2.bytes}`, `${f2.share.toFixed(1)}%`]) },
        lines: [
          b.largest && b.largest.share > 40 ? `"${b.largest.field}" is ${b.largest.share.toFixed(0)}% of the response \u2014 a list endpoint that most clients ignore is the usual cause.` : "No single field dominates; the size is spread across the shape itself.",
          "Compression is NOT estimated here: the ratio depends on the data and the encoder, and a guessed ratio is the kind of number that looks precise and gets quoted in a design doc."
        ],
        basis: "UTF-8 byte length as the wire sees it, measured per top-level field (key + value); gzip is deliberately not estimated"
      };
    }
  },
  {
    id: "idempotency",
    domain: "api",
    label: "Idempotency key",
    blurb: "Checks a key the way a payment API will, and states the entropy it actually carries.",
    fields: [
      text("key", "Key", "3f8a1c9b-6d2e-4f71-9a55-2c7e8b0d4e13"),
      num("ttl", "Retention (hours)", "24", "how long the server must remember the key")
    ],
    run: (v) => {
      const c = checkIdempotencyKey(str(v, "key"));
      const ttl = number(v, "ttl", 24);
      return {
        headline: c.ok ? `Usable \u2014 ${c.charset}, ~${c.entropyBits} bits` : `${c.issues.length} issue(s)`,
        ok: c.ok,
        kpis: [
          { value: c.charset, label: "shape" },
          { value: `${c.length}`, label: "characters" },
          { value: `~${c.entropyBits}`, label: "bits (measured)" },
          { value: `${ttl}h`, label: "retention asked" }
        ],
        lines: [
          ...c.issues,
          `Retention is the other half of the contract: a key remembered for ${ttl} hour(s) means a retry after that window is a NEW charge. The client's retry budget and the server's retention must agree \u2014 that gap is how a duplicate payment happens with an idempotency key in place.`,
          "The measured bits come from the string's own character distribution. A key that LOOKS random but was typed by a human measures low, which is exactly what you want to catch."
        ],
        basis: "Shannon entropy over the key's characters as a floor on guessability (not a guarantee of randomness), plus the shape rules payment APIs enforce"
      };
    }
  },
  {
    id: "paging",
    domain: "api",
    label: "Pagination",
    blurb: "Pages, last-page size and whether the offset is deep enough to hurt.",
    fields: [
      num("total", "Total rows", "250000"),
      num("size", "Page size", "100"),
      num("offset", "Offset used", "25000"),
      num("limit", "Deep-offset warning above", "10000")
    ],
    run: (v) => {
      const p = paginationPlan(
        Math.round(number(v, "total", 25e4)),
        Math.round(number(v, "size", 100)),
        Math.round(number(v, "offset", 25e3)),
        Math.round(number(v, "limit", 1e4))
      );
      return {
        headline: p.deep ? `Deep paging at offset ${number(v, "offset", 25e3)}` : `${p.pages.toLocaleString()} pages`,
        ok: !p.deep,
        kpis: [
          { value: p.pages.toLocaleString(), label: "pages" },
          { value: `${p.lastPageSize}`, label: "last page rows" },
          { value: `#${p.currentPage.toLocaleString()}`, label: "page at this offset" }
        ],
        lines: p.lines,
        basis: "offset paging arithmetic; keyset paging is recommended above the configured depth because an offset scan is O(offset) while a cursor is O(page size)"
      };
    }
  }
];

// src/specialists/data.ts
function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const rank = p / 100 * (sorted.length - 1);
  const lo = Math.floor(rank), hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (rank - lo) * (sorted[hi] - sorted[lo]);
}
function percentiles(values, ps) {
  const sorted = [...values].sort((a, b) => a - b);
  return ps.map((p) => ({ p, value: percentile(sorted, p) }));
}
function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}
function stddev(values, sample = true) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const ss = values.reduce((a, b) => a + (b - m) ** 2, 0);
  return Math.sqrt(ss / (values.length - (sample ? 1 : 0)));
}
function outliersIqr(values, k = 1.5) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25), q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const lowerFence = q1 - k * iqr, upperFence = q3 + k * iqr;
  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
  const whys = [];
  if (values.length < 8) whys.push(`${values.length} points is a small sample for a quartile rule \u2014 the fences move a lot below about twenty.`);
  if (iqr === 0) whys.push("the middle half of the data is identical, so the fence collapses onto the median and everything else becomes an 'outlier' \u2014 the rule is degenerate on this data.");
  return { sorted, q1, q3, iqr, lowerFence, upperFence, outliers, whys };
}
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return sign * y;
}
function normalTwoSidedP(z) {
  return Math.max(0, Math.min(1, 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)))));
}
function abTest(trialsA, convA, trialsB, convB) {
  const pA = trialsA > 0 ? convA / trialsA : 0;
  const pB = trialsB > 0 ? convB / trialsB : 0;
  const pooled = trialsA + trialsB > 0 ? (convA + convB) / (trialsA + trialsB) : 0;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / Math.max(1, trialsA) + 1 / Math.max(1, trialsB)));
  const z = se > 0 ? (pB - pA) / se : 0;
  const p = normalTwoSidedP(z);
  const seDiff = Math.sqrt(pA * (1 - pA) / Math.max(1, trialsA) + pB * (1 - pB) / Math.max(1, trialsB));
  const diff = pB - pA;
  const guardrails = [];
  if (Math.min(trialsA, trialsB) < 100) guardrails.push("fewer than 100 trials in one arm \u2014 the normal approximation is unreliable at this size.");
  const successes = Math.min(convA, convB, trialsA - convA, trialsB - convB);
  if (successes < 10) guardrails.push("fewer than ten conversions or non-conversions in an arm \u2014 use an exact test instead of this one.");
  guardrails.push("peeking at a running test inflates the false-positive rate; the p-value is only valid for a sample size fixed in advance.");
  return {
    rateA: pA * 100,
    rateB: pB * 100,
    liftPct: pA > 0 ? diff / pA * 100 : 0,
    z,
    p,
    significant95: p < 0.05,
    significant99: p < 0.01,
    ciLowPct: (diff - 1.96 * seDiff) * 100,
    ciHighPct: (diff + 1.96 * seDiff) * 100,
    verdict: p < 0.05 ? `a difference this large is unlikely under the null (p = ${p.toFixed(4)})` : `no detectable difference at 95% (p = ${p.toFixed(4)}) \u2014 that is NOT evidence the two are equal`,
    guardrails
  };
}
function sampleSize(baselinePct, mdeRelativePct, power = 0.8, alpha = 0.05) {
  const p1 = baselinePct / 100;
  const p2 = p1 * (1 + mdeRelativePct / 100);
  const pBar = (p1 + p2) / 2;
  const zA = alpha === 0.01 ? 2.576 : alpha === 0.1 ? 1.645 : 1.96;
  const zB = power === 0.9 ? 1.282 : power === 0.95 ? 1.645 : 0.842;
  const delta = Math.abs(p2 - p1);
  if (delta === 0 || pBar <= 0 || pBar >= 1) return NaN;
  return Math.ceil(
    Math.pow(zA * Math.sqrt(2 * pBar * (1 - pBar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2) / Math.pow(delta, 2)
  );
}
var DATA_TOOLS = [
  {
    id: "percentiles",
    domain: "data",
    label: "Percentiles",
    blurb: "p50 / p90 / p95 / p99 from a series, with the method stated \u2014 including how few points you have.",
    fields: [area("values", "Values", "12, 18, 22, 25, 27, 31, 33, 35, 38, 41, 44, 52, 61, 88, 240", "one per line, or comma separated")],
    run: (v) => {
      const values = series(v, "values");
      if (values.length === 0) return { headline: "No numbers in that", ok: false, basis: "one value per line, or comma separated" };
      const ps = percentiles(values, [50, 90, 95, 99]);
      const m = mean(values), sd = stddev(values);
      const small2 = values.length < 20;
      return {
        headline: `${values.length} points \xB7 median ${Math.round(m)} \xB7 max ${Math.max(...values)}`,
        ok: !small2,
        kpis: [
          { value: `${values.length}`, label: "points" },
          { value: m.toFixed(1), label: "mean" },
          { value: sd.toFixed(1), label: "std dev" },
          { value: `${Math.min(...values)}\u2013${Math.max(...values)}`, label: "range" }
        ],
        table: { head: ["Percentile", "Value"], rows: ps.map((x) => [`p${x.p}`, x.value.toFixed(1)]) },
        lines: [
          small2 ? `${values.length} points cannot support a p99: the top percentile of 15 samples is the maximum, not a percentile. Above p90 a small sample is decoration.` : "The sample is large enough for the percentiles above p90 to mean something.",
          `Mean ${m.toFixed(1)} vs median ${percentile([...values].sort((a, b) => a - b), 50).toFixed(1)} \u2014 the gap is how much the tail is dragging the average. A latency SLO written as a mean is a SLO that hides the users who left.`
        ],
        basis: "linear interpolation between order statistics (the R-7 / NumPy default); stating the method matters because p95 differs between conventions"
      };
    }
  },
  {
    id: "outliers",
    domain: "data",
    label: "Outliers",
    blurb: "IQR fences, the points outside them, and when the rule is meaningless.",
    fields: [
      area("values", "Values", "10, 11, 12, 12, 13, 13, 14, 15, 16, 17, 18, 120", "one per line or comma separated"),
      num("k", "Fence multiplier (k)", "1.5", "1.5 is the usual rule; 3 is 'far out'")
    ],
    run: (v) => {
      const values = series(v, "values");
      if (values.length === 0) return { headline: "No numbers in that", ok: false, basis: "one value per line, or comma separated" };
      const r = outliersIqr(values, number(v, "k", 1.5));
      return {
        headline: r.outliers.length ? `${r.outliers.length} point(s) outside the fences` : "Nothing outside the fences",
        ok: r.outliers.length === 0,
        kpis: [
          { value: r.q1.toFixed(1), label: "Q1" },
          { value: r.q3.toFixed(1), label: "Q3" },
          { value: r.iqr.toFixed(1), label: "IQR" },
          { value: `${r.lowerFence.toFixed(1)} \u2026 ${r.upperFence.toFixed(1)}`, label: "fences" }
        ],
        lines: [
          r.outliers.length ? `Outside: ${r.outliers.join(", ")}. An outlier is a question, not a verdict \u2014 the next step is to look at what those rows have in common, not to delete them.` : "Every point sits inside the fences.",
          ...r.whys
        ],
        basis: `Tukey's fences: outside Q1 \u2212 ${number(v, "k", 1.5)}\xB7IQR and Q3 + ${number(v, "k", 1.5)}\xB7IQR; quartiles by linear interpolation`
      };
    }
  },
  {
    id: "ab-test",
    domain: "data",
    label: "A/B test",
    blurb: "Two-proportion test with the lift, the interval, and the peeking warning.",
    fields: [
      num("trialsA", "Control trials", "5000"),
      num("convA", "Control conversions", "400"),
      num("trialsB", "Variant trials", "5000"),
      num("convB", "Variant conversions", "452")
    ],
    run: (v) => {
      const r = abTest(
        Math.round(number(v, "trialsA", 5e3)),
        Math.round(number(v, "convA", 400)),
        Math.round(number(v, "trialsB", 5e3)),
        Math.round(number(v, "convB", 452))
      );
      return {
        headline: r.significant95 ? `Significant \u2014 ${r.liftPct >= 0 ? "+" : ""}${r.liftPct.toFixed(1)}% relative lift` : `Not significant \u2014 ${r.liftPct >= 0 ? "+" : ""}${r.liftPct.toFixed(1)}% relative lift`,
        ok: r.significant95,
        kpis: [
          { value: `${r.rateA.toFixed(2)}%`, label: "control rate" },
          { value: `${r.rateB.toFixed(2)}%`, label: "variant rate" },
          { value: `${r.liftPct >= 0 ? "+" : ""}${r.liftPct.toFixed(1)}%`, label: "relative lift" },
          { value: `${r.ciLowPct >= 0 ? "+" : ""}${r.ciLowPct.toFixed(2)}% \u2026 ${r.ciHighPct >= 0 ? "+" : ""}${r.ciHighPct.toFixed(2)}%`, label: "95% interval" }
        ],
        lines: [
          r.verdict,
          `Absolute difference ${(r.rateB - r.rateA).toFixed(3)} percentage points \xB7 z = ${r.z.toFixed(3)} \xB7 p = ${r.p.toFixed(4)} (two-sided).`,
          ...r.guardrails
        ],
        basis: "two-proportion z-test on the pooled proportion; 95% interval is the Wald interval on the difference. The normal CDF is the Abramowitz & Stegun 7.1.26 approximation (error \u2248 1.5e-7)"
      };
    }
  },
  {
    id: "sample-size",
    domain: "data",
    label: "Sample size",
    blurb: "How many trials a test needs before it starts \u2014 the question usually asked too late.",
    fields: [
      num("baseline", "Baseline rate (%)", "8"),
      num("mde", "Minimum detectable effect (%)", "10", "relative to the baseline"),
      sel("power", "Power", ["0.8", "0.9", "0.95"], "0.8"),
      sel("alpha", "Alpha", ["0.05", "0.01", "0.1"], "0.05")
    ],
    run: (v) => {
      const n2 = sampleSize(number(v, "baseline", 8), number(v, "mde", 10), Number(str2(v, "power")) || 0.8, Number(str2(v, "alpha")) || 0.05);
      if (!Number.isFinite(n2)) return {
        headline: "That combination has no finite sample size",
        ok: false,
        basis: "a zero effect or a rate at 0/100% cannot be sized \u2014 check the inputs"
      };
      const perDay = number(v, "baseline", 8) > 0 ? null : null;
      return {
        headline: `${n2.toLocaleString()} trials per arm`,
        ok: true,
        kpis: [
          { value: n2.toLocaleString(), label: "per arm" },
          { value: (n2 * 2).toLocaleString(), label: "total" },
          { value: `${number(v, "baseline", 8)}% \u2192 ${(number(v, "baseline", 8) * (1 + number(v, "mde", 10) / 100)).toFixed(2)}%`, label: "detecting" }
        ],
        lines: [
          `Detecting a ${number(v, "mde", 10)}% relative change on an ${number(v, "baseline", 8)}% baseline needs ${n2.toLocaleString()} per arm at ${(Number(str2(v, "power")) || 0.8) * 100}% power.`,
          "Sample size is a function of the effect you are trying to detect, not of the traffic you happen to have \u2014 if the traffic cannot reach this number in a sensible time, the honest move is to test a bigger change, not a smaller sample.",
          perDay ? "" : "Halving the effect roughly QUADRUPLES the sample: the relationship is inverse-square."
        ].filter(Boolean),
        basis: "two-proportion formula with a pooled variance term and the normal quantiles for the chosen alpha and power (no continuity correction)"
      };
    }
  }
];
function str2(v, key2) {
  const x = v[key2];
  return typeof x === "string" ? x : typeof x === "boolean" ? String(x) : "";
}

// src/specialists/security.ts
var PATTERNS = [
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/g, note: "AKIA-prefixed; rotate and check CloudTrail for use" },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, note: "GitHub PAT \u2014 revoke first, then rewrite history" },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, note: "Slack app/bot token" },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, note: "an actual private key in the file \u2014 treat the key as compromised" },
  { name: "JSON Web Token", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, note: "a signed token; it is bearer authority until it expires" },
  { name: "Stripe secret key", re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, note: "Stripe secret key \u2014 live keys can move money" },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g, note: "Google API key; check its referrer/IP restrictions" },
  { name: "Connection string", re: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/]+:[^\s@/]+@/gi, note: "embeds a password in a URL \u2014 the password is in every log line that prints this string" },
  { name: "Assigned secret", re: /\b(?:api[_-]?key|secret|passwd|password|token|client[_-]?secret)\b\s*[:=]\s*["']?([A-Za-z0-9_\-./+]{16,})["']?/gi, note: "generic assignment \u2014 HIGH false-positive rate by nature; treat as a prompt to look, not a finding" }
];
function maskSecret(s) {
  if (s.length <= 8) return "\u2022".repeat(s.length);
  return `${s.slice(0, 4)}${"\u2022".repeat(Math.max(4, Math.min(24, s.length - 8)))}${s.slice(-4)}`;
}
function scanSecrets(text2) {
  const hits2 = [];
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : `${p.re.flags}g`);
    const found = [];
    let m;
    while ((m = re.exec(text2)) !== null) {
      found.push(m[1] ?? m[0]);
      if (found.length >= 50) break;
    }
    if (found.length > 0) {
      hits2.push({ name: p.name, count: found.length, samples: [...new Set(found)].slice(0, 3).map(maskSecret), note: p.note });
    }
  }
  return hits2;
}
function b64urlDecode(part) {
  const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - part.length % 4);
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const g = globalThis;
  if (!g.atob || !g.TextDecoder) throw new Error("no base64 decoder available in this runtime");
  const binary = g.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new g.TextDecoder("utf-8").decode(bytes);
}
function jwtInspect(token, nowIso) {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return { ok: false, error: `${parts.length} segments \u2014 a JWS has 3 (header.payload.signature)`, lines: [] };
  try {
    const header = JSON.parse(b64urlDecode(parts[0]));
    const payload = JSON.parse(b64urlDecode(parts[1]));
    const algorithm = String(header.alg ?? "(none declared)");
    const lines = [];
    let expired = null;
    let expiresIn;
    const now = Math.floor((/* @__PURE__ */ new Date(`${nowIso}T00:00:00Z`)).getTime() / 1e3);
    const exp2 = typeof payload.exp === "number" ? payload.exp : void 0;
    if (exp2 !== void 0) {
      expired = exp2 <= now;
      const secs = exp2 - now;
      expiresIn = expired ? `expired ${Math.abs(Math.round(secs / 3600))} h ago` : `${(secs / 3600).toFixed(1)} h remaining`;
      lines.push(`exp is ${new Date(exp2 * 1e3).toISOString()} \u2014 ${expiresIn}.`);
    } else {
      lines.push("No exp claim: this token never expires on its own. That is a finding, not a detail.");
    }
    if (algorithm === "none") lines.push('alg is "none" \u2014 the token carries NO signature. Anything that accepts it is accepting unsigned authority.');
    if (typeof payload.aud !== "undefined") lines.push(`aud: ${JSON.stringify(payload.aud)} \u2014 check the token was minted FOR this service.`);
    lines.push("The signature was NOT verified and the payload was NOT trusted: this decodes what anyone holding the token can read. Verification needs the key, which this engine deliberately does not hold.");
    return { ok: true, header, payload, algorithm, ...expiresIn ? { expiresIn } : {}, expired, lines };
  } catch (e) {
    return { ok: false, error: `could not decode \u2014 ${String(e)}`, lines: [] };
  }
}
function cspAudit(header, hasNonce = false) {
  const directives = [];
  const findings = [];
  const map = /* @__PURE__ */ new Map();
  for (const clause of header.split(";")) {
    const t = clause.trim();
    if (!t) continue;
    const [name, ...values] = t.split(/\s+/);
    if (!name) continue;
    const key2 = name.toLowerCase();
    directives.push(key2);
    map.set(key2, values);
  }
  const src = (k) => map.get(k) ?? [];
  const allSources = [...map.values()].flat();
  if (!map.has("default-src")) findings.push({
    directive: "default-src",
    severity: "high",
    finding: "no default-src: every fetch directive you did not write falls back to the browser default, which is wide open"
  });
  if (allSources.includes("*")) findings.push({
    directive: "*",
    severity: "high",
    finding: "a wildcard source makes the policy decorative \u2014 any host can serve script"
  });
  if (src("script-src").includes("'unsafe-inline'") && !hasNonce) findings.push({
    directive: "script-src",
    severity: "high",
    finding: "'unsafe-inline' without a nonce or hash defeats the point of script-src: injected inline script runs"
  });
  if (src("script-src").includes("'unsafe-eval'")) findings.push({
    directive: "script-src",
    severity: "high",
    /* The hygiene gate greps for the call form, so the finding is worded without it —
       the gate is right to be that literal about a product with one sandboxed eval surface. */
    finding: "'unsafe-eval' permits dynamic code evaluation \u2014 the gadget most XSS payloads need"
  });
  if (["http:", "https:"].some((s) => allSources.includes(s))) findings.push({
    directive: "scheme-only source",
    severity: "medium",
    finding: "a bare http:/https: source allows ANY host over that scheme"
  });
  if (!map.has("frame-ancestors") && !map.has("x-frame-options")) findings.push({
    directive: "frame-ancestors",
    severity: "medium",
    finding: "no frame-ancestors (and no X-Frame-Options): the page can be framed, so clickjacking is on the table"
  });
  if (!map.has("object-src")) findings.push({
    directive: "object-src",
    severity: "low",
    finding: "no object-src: legacy plugin content (object/embed/applet) is unrestricted; 'object-src 'none'' is the usual close"
  });
  if (!map.has("base-uri")) findings.push({
    directive: "base-uri",
    severity: "medium",
    finding: "no base-uri: an injected <base> tag can redirect every relative URL on the page"
  });
  if (allSources.includes("data:") && (map.get("script-src") ?? []).includes("data:")) findings.push({
    directive: "script-src data:",
    severity: "high",
    finding: "data: URLs as script sources let an injected payload carry its own code inline"
  });
  return { directives, findings };
}
var SECURITY_TOOLS = [
  {
    id: "entropy",
    domain: "security",
    label: "Entropy",
    blurb: "How many bits a string actually carries \u2014 a floor on guessability, stated as a measure.",
    fields: [text("s", "String", "correct-horse-battery-staple", "paste a candidate password, key or token")],
    run: (v) => {
      const s = str(v, "s");
      if (!s) return { headline: "Nothing to measure", ok: false, basis: "paste the string" };
      const bits = stringEntropyBits(s);
      const perChar = bits / s.length;
      const alphabet = new Set(s).size;
      const verdict = bits < 40 ? "low \u2014 brute-forceable at scale" : bits < 70 ? "moderate \u2014 acceptable for a rate-limited login, not for a key" : bits < 100 ? "good for a password" : "strong";
      return {
        headline: `~${Math.round(bits)} bits \u2014 ${verdict}`,
        ok: bits >= 70,
        kpis: [
          { value: `~${Math.round(bits)}`, label: "measured bits" },
          { value: perChar.toFixed(2), label: "bits / character" },
          { value: `${s.length}`, label: "characters" },
          { value: `${alphabet}`, label: "distinct characters" }
        ],
        lines: [
          `This is Shannon entropy over the string's OWN character distribution. It measures the string, not the generator: "aaaaaaaaaaaaaaaa" measures zero however random the dice were, and a long passphrase of real words measures high while being memorable.`,
          "For key material, a CSPRNG's true entropy is a property of the generator (16 bytes = 128 bits), not of the output. Use this for passwords, where the human is the generator."
        ],
        basis: "Shannon entropy H = \u2212\u03A3 p\xB7log\u2082p, multiplied by length; a lower bound on how hard the string is to guess from its characters alone"
      };
    }
  },
  {
    id: "secrets",
    domain: "security",
    label: "Secret scan",
    blurb: "Finds the credential shapes that have a fixed format \u2014 and says what it cannot find.",
    fields: [area("text", "Text to scan", 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nDATABASE_URL=postgres://app:hunter2@db.internal:5432/prod\n\ntoken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123456"', "a .env file, a log line, a config diff")],
    run: (v) => {
      const text2 = str(v, "text");
      const hits2 = scanSecrets(text2);
      const genericOnly = hits2.length > 0 && hits2.every((h) => h.name === "Assigned secret");
      return {
        headline: hits2.length ? `${hits2.length} pattern(s) matched` : "No known credential pattern matched",
        ok: hits2.length === 0,
        kpis: [
          { value: `${hits2.length}`, label: "pattern kinds" },
          { value: `${hits2.reduce((a, h) => a + h.count, 0)}`, label: "matches" }
        ],
        table: hits2.length ? { head: ["Pattern", "Matches", "Sample", "What to do"], rows: hits2.map((h) => [h.name, `${h.count}`, h.samples[0] ?? "", h.note]) } : void 0,
        lines: [
          hits2.length ? "A match is not a leak on its own \u2014 it is a prompt. The order that matters: revoke, then rotate, then look at where it was committed." : "Nothing matched. That is not a clean bill of health.",
          genericOnly ? "Only the GENERIC assignment pattern matched, which by nature matches variable names as readily as secrets \u2014 read the sample before acting." : "The patterns here have fixed formats (vendor prefixes, key headers), which is why they can be trusted enough to print.",
          "What this does NOT find: a secret with no distinctive format (a bare 32-character hex string), a secret split across lines, a secret in an image, an encrypted blob, or anything in a repository you did not scan."
        ],
        basis: "pattern matching against a fixed set of known credential formats, plus one deliberately-noisy generic assignment pattern; matches are masked (first four and last four characters) so the finding does not become a second copy of the secret"
      };
    }
  },
  {
    id: "jwt",
    domain: "security",
    label: "JWT inspect",
    blurb: "Decodes a JWT's claims and expiry \u2014 and is explicit that it does not verify it.",
    fields: [
      area("token", "Token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhY2N0XzlmMiIsImF1ZCI6ImFwaS5leGFtcGxlLmNvbSIsImV4cCI6MTc5MDAwMDAwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"),
      text("now", "Evaluate as on", "2026-09-22")
    ],
    run: (v) => {
      const ins = jwtInspect(str(v, "token"), str(v, "now", "2026-09-22"));
      if (!ins.ok) return { headline: "Not a decodable JWT", ok: false, lines: ins.error ? [ins.error] : [], basis: "a JWS is header.payload.signature, base64url encoded" };
      const warn = ins.algorithm === "none" || ins.expired === true || ins.expired === null;
      return {
        headline: `alg ${ins.algorithm ?? "?"}${ins.expiresIn ? ` \xB7 ${ins.expiresIn}` : ""}`,
        ok: !warn,
        kpis: [
          { value: ins.algorithm ?? "?", label: "algorithm" },
          { value: ins.expired === void 0 || ins.expired === null ? "no exp" : ins.expired ? "expired" : "live", label: "expiry" },
          { value: String(ins.payload?.aud ?? "\u2014").slice(0, 24), label: "audience" },
          { value: String(ins.payload?.iss ?? "\u2014").slice(0, 24), label: "issuer" }
        ],
        code: JSON.stringify(ins.payload, null, 2),
        lines: ins.lines,
        basis: "base64url decoding only \u2014 NO signature verification, NO trust in the payload; decoding proves what the token SAYS, never that it was issued by who it claims"
      };
    }
  },
  {
    id: "csp",
    domain: "security",
    label: "CSP audit",
    blurb: "Reads a Content-Security-Policy header and names the clauses that are doing nothing.",
    fields: [
      area("header", "Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src * data:; connect-src https:;", "paste the header value, not the header name"),
      num("nonce", "Uses a nonce?", "0", "1 if script-src carries a nonce or hash")
    ],
    run: (v) => {
      const audit = cspAudit(str(v, "header"), number(v, "nonce", 0) === 1);
      const high = audit.findings.filter((f2) => f2.severity === "high").length;
      return {
        headline: `${audit.directives.length} directive(s) \xB7 ${audit.findings.length} finding(s)${high ? `, ${high} high` : ""}`,
        ok: audit.findings.length === 0,
        kpis: [
          { value: `${audit.directives.length}`, label: "directives" },
          { value: `${high}`, label: "high severity" },
          { value: audit.directives.includes("default-src") ? "yes" : "NO", label: "default-src" }
        ],
        table: audit.findings.length ? { head: ["Directive", "Severity", "Finding"], rows: audit.findings.map((f2) => [f2.directive, f2.severity, f2.finding]) } : void 0,
        lines: audit.findings.length === 0 ? ["No findings from this audit. That is not the same as a strong policy \u2014 this checks a fixed list of known weaknesses, not the fit between the policy and the application."] : ["A missing default-src is the highest-value fix: it closes every directive that was never written."],
        basis: "checks against the known CSP weaknesses (wildcards, scheme-only sources, unsafe-inline without a nonce, unsafe-eval, missing base-uri / frame-ancestors / object-src) \u2014 a fixed checklist, not a full policy analysis"
      };
    }
  }
];

// src/specialists/ops.ts
function sloErrorBudget(sloPercent, windowDays, consumedPercent) {
  const windowMinutes = windowDays * 24 * 60;
  const allowedDownMinutes = windowMinutes * (1 - sloPercent / 100);
  const consumedMinutes = allowedDownMinutes * (consumedPercent / 100);
  const remainingMinutes = allowedDownMinutes - consumedMinutes;
  const burnRate = consumedPercent / 100;
  const timeToExhaustHours = burnRate > 0 ? remainingMinutes / (consumedMinutes || 1) * windowMinutes / 60 : null;
  const state = burnRate >= 1 ? "exhausted \u2014 the SLO is breached for this window" : burnRate > 0.5 ? "over half spent \u2014 freeze feature work, or the breach is a matter of when" : burnRate > 0.2 ? "normal burn" : "comfortable";
  return { windowMinutes, allowedDownMinutes, consumedMinutes, remainingMinutes, burnRate, timeToExhaustHours, state };
}
function capacityHeadroom(currentPct, growthPctPerMonth, targetPct, months = 24) {
  if (growthPctPerMonth <= 0) {
    return {
      breachMonth: null,
      atTarget: `${targetPct}%`,
      lines: [`At ${growthPctPerMonth}% monthly growth the utilisation never rises \u2014 a flat or falling curve needs no capacity decision, only a check that the flatness is not an outage.`]
    };
  }
  let level = currentPct;
  let breachMonth = null;
  for (let m = 1; m <= months; m++) {
    level = level * (1 + growthPctPerMonth / 100);
    if (level >= targetPct && breachMonth === null) breachMonth = m;
  }
  return {
    breachMonth,
    atTarget: `${level.toFixed(1)}% after ${months} months`,
    lines: [
      breachMonth === null ? `Utilisation reaches ${level.toFixed(1)}% after ${months} months and stays below the ${targetPct}% ceiling \u2014 the runway is longer than this horizon.` : `Utilisation crosses ${targetPct}% in month ${breachMonth} (about ${(breachMonth / 12).toFixed(1)} years). That is the deadline for the capacity work, and it is a deadline that does not move because nobody planned for it.`,
      "Compound growth flattens this calculation fast: a 1-point change in the monthly rate moves the breach month more than a 10% change in headroom."
    ]
  };
}
var SEVERITY_RULES = [
  "S1 \u2014 data loss or corruption, a security breach, or a total outage of the primary product",
  "S2 \u2014 a core journey is broken for many users, or revenue collection is impaired",
  "S3 \u2014 a feature is degraded or unavailable with a workaround available",
  "S4 \u2014 cosmetic or single-user impact"
];
function incidentSeverity(usersAffectedPct, revenueImpactPct, dataLoss, hasWorkaround) {
  let severity = "S4";
  const reasons = [];
  if (dataLoss) {
    severity = "S1";
    reasons.push("data loss or corruption is present \u2014 severity is S1 regardless of how many users noticed");
  } else if (usersAffectedPct >= 50 || revenueImpactPct >= 10) {
    severity = "S2";
    reasons.push(`${usersAffectedPct}% of users affected and ${revenueImpactPct}% revenue impact \u2014 a core journey, so S2`);
  } else if (usersAffectedPct >= 10 || revenueImpactPct >= 2) {
    severity = hasWorkaround ? "S3" : "S2";
    reasons.push(hasWorkaround ? "material impact with a workaround available, which is what separates S3 from S2" : "material impact and NO workaround, which promotes this to S2");
  } else {
    severity = "S4";
    reasons.push("impact is below the material thresholds \u2014 S4");
  }
  return { severity, why: reasons.join("; "), rules: SEVERITY_RULES };
}
function deployRisk(changedFiles, hasMigration, testsGreen, rollbackReady, offPeak, flagged) {
  const factors = [
    { factor: "Test suite", weight: testsGreen ? 0 : 30, why: "shipping with a failing or unknown test suite is the single largest avoidable risk" },
    { factor: "Rollback path", weight: rollbackReady ? 0 : 20, why: "no tested rollback means an incident becomes an archaeology exercise" },
    { factor: "Migration", weight: hasMigration ? 15 : 0, why: "a schema change outlives the deploy that made it" },
    { factor: "Blast radius", weight: changedFiles > 50 ? 15 : changedFiles > 15 ? 8 : 0, why: `${changedFiles} files changed \u2014 wide diffs are harder to reason about under pressure` },
    { factor: "Timing", weight: offPeak ? 0 : 10, why: "deploying into peak removes the calm window you would want to fix it in" },
    { factor: "Feature flag", weight: flagged ? 0 : 10, why: "without a flag the only way back is another deploy" }
  ];
  const score = Math.min(100, factors.reduce((a, f2) => a + f2.weight, 0));
  const recommendation = score === 0 ? "Ship. Every risk factor this model checks is addressed." : score <= 15 ? "Ship, with a human watching the dashboards for the first thirty minutes." : score <= 40 ? "Ship behind a flag, or fix the cheapest factor above first \u2014 the score is dominated by one or two items, not by the diff." : "Do not ship yet. At this score the cheapest fix (usually the test suite or the rollback path) buys more than the delay costs.";
  return { score, recommendation, factors };
}
var OPS_TOOLS = [
  {
    id: "error-budget",
    domain: "ops",
    label: "Error budget",
    blurb: "What a SLO actually permits, how much is gone, and how long until the breach.",
    fields: [
      num("slo", "SLO (%)", "99.9"),
      num("window", "Window (days)", "30"),
      num("consumed", "Budget consumed (%)", "35")
    ],
    run: (v) => {
      const b = sloErrorBudget(number(v, "slo", 99.9), number(v, "window", 30), number(v, "consumed", 35));
      const hours = (b.allowedDownMinutes / 60).toFixed(1);
      return {
        headline: `${b.remainingMinutes.toFixed(0)} of ${b.allowedDownMinutes.toFixed(0)} minutes remaining \u2014 ${b.state}`,
        ok: b.burnRate <= 0.5,
        kpis: [
          { value: `${hours} h`, label: `allowed downtime / ${number(v, "window", 30)}d` },
          { value: `${b.remainingMinutes.toFixed(0)} min`, label: "remaining" },
          { value: `${(b.burnRate * 100).toFixed(0)}%`, label: "budget burned" },
          { value: b.timeToExhaustHours === null ? "\u2014" : `${b.timeToExhaustHours.toFixed(0)} h`, label: "time to exhaust" }
        ],
        lines: [
          `A ${number(v, "slo", 99.9)}% SLO over ${number(v, "window", 30)} days allows ${hours} hours of failure \u2014 about ${(b.allowedDownMinutes / number(v, "window", 30)).toFixed(1)} minutes a day.`,
          b.state,
          "An error budget is a decision rule, not a report: spending it on a risky launch is legitimate, and so is freezing features when it is gone. What is not legitimate is discovering the breach after the fact."
        ],
        basis: "budget = (1 \u2212 SLO) \xD7 window; burn rate = consumed / budget; time-to-exhaust extrapolates the consumption rate observed so far (it is a straight-line estimate, and it says so)"
      };
    }
  },
  {
    id: "capacity",
    domain: "ops",
    label: "Capacity",
    blurb: "How many months of runway the current utilisation and growth rate leave.",
    fields: [
      num("current", "Current utilisation (%)", "42"),
      num("growth", "Growth (% / month)", "6"),
      num("target", "Ceiling (%)", "80"),
      num("months", "Horizon (months)", "24")
    ],
    run: (v) => {
      const c = capacityHeadroom(
        number(v, "current", 42),
        number(v, "growth", 6),
        number(v, "target", 80),
        Math.round(number(v, "months", 24))
      );
      return {
        headline: c.breachMonth === null ? `No breach inside the horizon (${c.atTarget})` : `Breach in month ${c.breachMonth}`,
        ok: c.breachMonth === null || c.breachMonth > 6,
        kpis: [
          { value: `${number(v, "current", 42)}%`, label: "now" },
          { value: `${number(v, "growth", 6)}%/mo`, label: "growth" },
          { value: `${number(v, "target", 80)}%`, label: "ceiling" },
          { value: c.atTarget, label: "at horizon" }
        ],
        lines: c.lines,
        basis: "compound growth on utilisation; the ceiling is a planning line, not a physical limit \u2014 the tool does not model the knee in the performance curve before saturation"
      };
    }
  },
  {
    id: "severity",
    domain: "ops",
    label: "Severity",
    blurb: "Turns impact numbers into an S1\u2013S4 call, with the rule that produced it.",
    fields: [
      num("users", "Users affected (%)", "12"),
      num("revenue", "Revenue impact (%)", "1"),
      flag("dataLoss", "Data loss or corruption", false),
      flag("workaround", "A workaround exists", true)
    ],
    run: (v) => {
      const s = incidentSeverity(
        number(v, "users", 12),
        number(v, "revenue", 1),
        v["dataLoss"] === true,
        v["workaround"] === true
      );
      return {
        headline: `${s.severity} \u2014 ${s.why.split(";")[0]}`,
        ok: s.severity === "S3" || s.severity === "S4",
        kpis: [{ value: s.severity, label: "severity" }],
        lines: [s.why, ...s.rules],
        basis: "an explicit impact matrix: data loss is always S1; \u226550% of users or \u226510% revenue is S2; a workaround is what separates S3 from S2 \u2014 the rule is printed so it can be argued with during an incident"
      };
    }
  },
  {
    id: "deploy-risk",
    domain: "ops",
    label: "Deploy risk",
    blurb: "A disclosed weighting over the six things that turn a deploy into an incident.",
    fields: [
      num("files", "Files changed", "23"),
      flag("migration", "Includes a schema migration", false),
      flag("tests", "Tests green", true),
      flag("rollback", "Rollback tested", true),
      flag("offPeak", "Deploying off-peak", false),
      flag("flag", "Behind a feature flag", true)
    ],
    run: (v) => {
      const r = deployRisk(
        Math.round(number(v, "files", 23)),
        v["migration"] === true,
        v["tests"] === true,
        v["rollback"] === true,
        v["offPeak"] === true,
        v["flag"] === true
      );
      const active = r.factors.filter((f2) => f2.weight > 0);
      return {
        headline: `Risk ${r.score}/100 \u2014 ${r.recommendation.split(".")[0]}.`,
        ok: r.score <= 15,
        kpis: [{ value: `${r.score}`, label: "risk score" }, { value: `${active.length}`, label: "factors active" }],
        table: { head: ["Factor", "Weight", "Why"], rows: r.factors.map((f2) => [f2.factor, f2.weight ? `+${f2.weight}` : "\u2014", f2.why]) },
        lines: [r.recommendation, "The weights are a judgement, printed in full so a team can change them; what is not optional is writing them down."],
        basis: "additive weighted model over six factors (tests, rollback, migration, blast radius, timing, feature flag), capped at 100 \u2014 deliberately simple so the gate can be explained to the person it stops"
      };
    }
  }
];

// src/specialists/docs.ts
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}
function readability(text2) {
  const clean = text2.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const sentences = clean.split(/[.!?]+(?:\s|$)/).map((s) => s.trim()).filter((s) => s.length > 0);
  const words = clean.split(/\s+/).map((w) => w.replace(/[^A-Za-z'-]/g, "")).filter((w) => w.length > 0);
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const sCount = Math.max(1, sentences.length), wCount = Math.max(1, words.length);
  const asl = wCount / sCount, asw = syl / wCount;
  const ease = 206.835 - 1.015 * asl - 84.6 * asw;
  const grade = 0.39 * asl + 11.8 * asw - 15.59;
  const interpretation = grade <= 8 ? "reads at a general-audience level \u2014 appropriate for user-facing docs and onboarding" : grade <= 12 ? "reads at a high-school level \u2014 fine for developer documentation" : grade <= 16 ? "reads at an undergraduate level \u2014 expect re-reading; consider splitting sentences" : "reads at a graduate level \u2014 usually a symptom of long sentences rather than hard ideas; cut the sentences, not the ideas";
  return {
    words: wCount,
    sentences: sCount,
    syllables: syl,
    avgSentenceWords: Math.round(asl * 10) / 10,
    avgWordSyllables: Math.round(asw * 100) / 100,
    fleschReadingEase: Math.round(ease * 10) / 10,
    fleschKincaidGrade: Math.round(grade * 10) / 10,
    interpretation
  };
}
function readingTime(text2, wpm = 200) {
  const withoutCode = text2.replace(/```[\s\S]*?```/g, " ");
  const words = withoutCode.split(/\s+/).filter((w) => w.trim().length > 0).length;
  const codeLines = (text2.match(/```[\s\S]*?```/g) ?? []).reduce((a, block) => a + block.split("\n").length - 2, 0);
  return { words, minutes: words / wpm, codeLines };
}
function headingLint(markdown) {
  const issues = [];
  const counts = {};
  let h1 = 0, previous = 0;
  const seen = /* @__PURE__ */ new Set();
  markdown.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^(#{1,6})\s*(.*)$/);
    if (!m) return;
    const level = m[1].length;
    const text2 = m[2].trim();
    counts[level] = (counts[level] ?? 0) + 1;
    if (level === 1) h1++;
    if (!text2) issues.push({ line: i + 1, heading: line.trim(), issue: "empty heading" });
    if (previous !== 0 && level > previous + 1) {
      issues.push({ line: i + 1, heading: text2, issue: `jumps from h${previous} to h${level} \u2014 a skipped level breaks the table of contents and the outline for screen readers` });
    }
    const anchor = text2.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, "-");
    if (text2 && seen.has(anchor)) issues.push({ line: i + 1, heading: text2, issue: "duplicate heading text \u2014 the anchor collides with the earlier one" });
    seen.add(anchor);
    previous = level;
  });
  if (h1 === 0) issues.push({ line: 0, heading: "(document)", issue: "no h1 \u2014 the document has no title for a reader, a search result or a screen reader" });
  if (h1 > 1) issues.push({ line: 0, heading: "(document)", issue: `${h1} h1 headings \u2014 a document with several titles has no title` });
  return { h1, counts, issues };
}
var VARIANTS = [
  [/\be-?mail(s?)\b/gi, "email"],
  [/\blog ?-?in\b/gi, "log in"],
  [/\bset ?up\b/gi, "set up"],
  [/\bweb ?site\b/gi, "website"],
  [/\bback ?end\b/gi, "backend"],
  [/\bfront ?end\b/gi, "frontend"]
];
function terminologyDrift(text2) {
  const out = [];
  const byLower = /* @__PURE__ */ new Map();
  for (const raw of text2.split(/\s+/)) {
    const w = raw.replace(/[^A-Za-z]/g, "");
    if (w.length < 3 || /^[A-Z]+$/.test(w) && w.length <= 3) continue;
    const key2 = w.toLowerCase();
    if (!byLower.has(key2)) byLower.set(key2, /* @__PURE__ */ new Map());
    const m = byLower.get(key2);
    m.set(w, (m.get(w) ?? 0) + 1);
  }
  for (const [key2, forms] of byLower) {
    if (forms.size > 1 && [...forms.values()].some((n2) => n2 > 1)) {
      out.push({
        term: key2,
        variants: [...forms.entries()].map(([form, count]) => ({ form, count })).sort((a, b) => b.count - a.count),
        note: "the same word is written more than one way \u2014 pick one and use it everywhere; search and glossary lookups depend on it"
      });
    }
  }
  for (const [re, canonical] of VARIANTS) {
    const found = /* @__PURE__ */ new Map();
    let m;
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    while ((m = g.exec(text2)) !== null) found.set(m[0], (found.get(m[0]) ?? 0) + 1);
    if (found.size > 1) {
      out.push({
        term: canonical,
        variants: [...found.entries()].map(([form, count]) => ({ form, count })).sort((a, b) => b.count - a.count),
        note: `variants of "${canonical}" appear \u2014 hyphenation drift is the most common form of this`
      });
    }
  }
  return out;
}
var SAMPLE = `The steward receives your request and breaks it into steps. It runs each step with the tools you have connected, and it stops before anything that would spend money or change a system you did not authorise. When it stops, it asks you, and it records the answer together with what it ran.`;
var DOCS_TOOLS = [
  {
    id: "readability",
    domain: "docs",
    label: "Readability",
    blurb: "Flesch reading ease and grade level, with the sentence length that caused it.",
    fields: [area("text", "Prose", SAMPLE, "code blocks are stripped before measuring \u2014 they are not prose")],
    run: (v) => {
      const r = readability(str(v, "text"));
      if (r.words < 10) return { headline: "Too little prose to measure", ok: false, basis: "Flesch's formulas are unreliable below about ten words" };
      return {
        headline: `Grade ${r.fleschKincaidGrade} \xB7 ease ${r.fleschReadingEase}`,
        ok: r.fleschKincaidGrade <= 12,
        kpis: [
          { value: `${r.words}`, label: "words" },
          { value: `${r.sentences}`, label: "sentences" },
          { value: `${r.avgSentenceWords}`, label: "avg words / sentence" },
          { value: `${r.avgWordSyllables}`, label: "avg syllables / word" }
        ],
        lines: [
          r.interpretation,
          r.avgSentenceWords > 22 ? `Average sentence length is ${r.avgSentenceWords} words; long sentences are the usual cause of a high grade score, and splitting them lowers it without losing any content.` : "Sentence length is in the comfortable range."
        ],
        basis: "Flesch Reading Ease = 206.835 \u2212 1.015\xB7(words/sentences) \u2212 84.6\xB7(syllables/words); Flesch-Kincaid Grade = 0.39\xB7(words/sentences) + 11.8\xB7(syllables/words) \u2212 15.59. Syllables are estimated by vowel groups, so an unusual word can be a syllable out"
      };
    }
  },
  {
    id: "reading-time",
    domain: "docs",
    label: "Reading time",
    blurb: "Words, minutes and code lines \u2014 for knowing whether a page needs a summary.",
    fields: [area("text", "Document", `${SAMPLE}

\`\`\`ts
const x = 1;
const y = 2;
\`\`\``), num("wpm", "Words per minute", "200")],
    run: (v) => {
      const r = readingTime(str(v, "text"), number(v, "wpm", 200));
      const mins = r.minutes < 1 ? `${Math.ceil(r.minutes * 60)} seconds` : `${r.minutes.toFixed(1)} minutes`;
      return {
        headline: `${r.words} words \u2014 about ${mins}`,
        ok: r.minutes <= 8,
        kpis: [
          { value: `${r.words}`, label: "words" },
          { value: mins, label: "reading time" },
          { value: `${r.codeLines}`, label: "code lines" },
          { value: `${number(v, "wpm", 200)}`, label: "wpm assumed" }
        ],
        lines: [
          r.minutes > 8 ? "Past about eight minutes, a document is generally skimmed rather than read \u2014 a summary at the top is doing real work at this length." : "Short enough to be read rather than skimmed.",
          "Code lines are counted separately and excluded from the word count: a reader scans code at a very different rate from prose."
        ],
        basis: `words divided by ${number(v, "wpm", 200)} wpm; 200\u2013250 wpm is the usual range for technical prose read on a screen`
      };
    }
  },
  {
    id: "headings",
    domain: "docs",
    label: "Heading structure",
    blurb: "Level jumps, duplicate anchors, missing or multiplied titles.",
    fields: [area("text", "Markdown", "# Payments API\n\n## Authentication\n\n#### Tokens\n\n## Authentication\n\n### Errors", "paste markdown")],
    run: (v) => {
      const h = headingLint(str(v, "text"));
      const counts = Object.entries(h.counts).sort(([a], [b]) => Number(a) - Number(b));
      return {
        headline: h.issues.length ? `${h.issues.length} structural issue(s)` : "Structure is sound",
        ok: h.issues.length === 0,
        kpis: [
          { value: `${h.h1}`, label: "h1 headings" },
          { value: counts.map(([lvl, n2]) => `h${lvl}:${n2}`).join(" "), label: "by level" }
        ],
        table: h.issues.length ? { head: ["Line", "Heading", "Issue"], rows: h.issues.map((i) => [i.line ? `${i.line}` : "\u2014", i.heading, i.issue]) } : void 0,
        basis: "heading levels must not skip, anchors must not collide, and a document needs exactly one h1 \u2014 the rules a table of contents and a screen reader both depend on"
      };
    }
  },
  {
    id: "terminology",
    domain: "docs",
    label: "Terminology",
    blurb: "Finds the same word written two ways across a document set.",
    fields: [area("text", "Text", "The Kubernetes cluster runs in us-east-1. Developers deploy to the kubernetes cluster with kubectl. Log in on the login page, then Log In again.", "paste a page, a README, or a whole set")],
    run: (v) => {
      const drift2 = terminologyDrift(str(v, "text"));
      return {
        headline: drift2.length ? `${drift2.length} term(s) written inconsistently` : "No terminology drift found",
        ok: drift2.length === 0,
        table: drift2.length ? { head: ["Term", "Variants", "Why it matters"], rows: drift2.map((d) => [d.term, d.variants.map((x) => `${x.form} (${x.count})`).join(", "), d.note]) } : void 0,
        lines: [
          drift2.length ? "Consistent terms are what make search, glossary links and translation work \u2014 a reader who searches for the other spelling finds nothing." : "One spelling per word in the text supplied. This checks the text it was given, not the site-wide glossary."
        ],
        basis: "case-variant detection on repeated words, plus a fixed list of hyphenation variants (email/e-mail, login/log in, backend/back-end); acronyms of three letters or fewer are excluded, so API/http casing is not flagged"
      };
    }
  }
];

// src/specialists/growth.ts
function unitEconomics(arpuMonthly, grossMarginPct, cac, monthlyChurnPct) {
  const margin = arpuMonthly * (grossMarginPct / 100);
  const churn = monthlyChurnPct / 100;
  const ltv = churn > 0 ? margin / churn : Number.POSITIVE_INFINITY;
  const paybackMonths = margin > 0 ? cac / margin : Number.POSITIVE_INFINITY;
  const ratio = cac > 0 ? ltv / cac : Number.POSITIVE_INFINITY;
  const caveats = [];
  if (churn <= 0) caveats.push("zero churn makes lifetime value infinite, which is a modelling artefact rather than a result \u2014 use a real observed churn rate, even a pessimistic one.");
  if (monthlyChurnPct > 5) caveats.push(`at ${monthlyChurnPct}% monthly churn the average customer lasts about ${(100 / monthlyChurnPct).toFixed(1)} months; most of the lifetime value is being paid for twice.`);
  caveats.push("Gross margin, not revenue, is what repays acquisition cost \u2014 a business with a 20% margin needs five times the revenue of one with 100% to reach the same payback.");
  const verdict = ratio >= 3 && paybackMonths <= 18 ? "Healthy: lifetime value is at least three times acquisition cost and payback is inside eighteen months." : ratio >= 3 ? `The ratio is healthy but payback is ${paybackMonths.toFixed(0)} months \u2014 growth financed at that speed needs capital that believes in it.` : ratio >= 1 ? `Marginal: every customer eventually repays acquisition and then some, at a ratio of ${ratio.toFixed(1)}:1 where 3:1 is the usual bar.` : "Negative unit economics: each customer costs more to acquire than the margin they ever produce. More growth makes this worse, not better.";
  return { ltv, ltvCac: ratio, paybackMonths, grossMarginPerMonth: margin, verdict, caveats };
}
function funnel(counts, stages) {
  const steps = counts.map((count, i) => {
    const prev = i === 0 ? count : counts[i - 1];
    const top = counts[0] ?? 0;
    return {
      stage: stages[i] ?? `step ${i + 1}`,
      count,
      fromPrevious: prev > 0 ? count / prev * 100 : 0,
      fromTop: top > 0 ? count / top * 100 : 0,
      drop: prev - count
    };
  });
  const candidates = steps.slice(1);
  const worst = candidates.length > 0 ? candidates.reduce((a, b) => a.fromPrevious <= b.fromPrevious ? a : b) : null;
  return { steps, worst, overall: counts.length > 1 && (counts[0] ?? 0) > 0 ? counts[counts.length - 1] / counts[0] * 100 : 0 };
}
function riceScore(reach, impact, confidencePct, effort) {
  if (effort <= 0) return 0;
  return reach * impact * (confidencePct / 100) / effort;
}
function growthModel(startMrr, growthPctPerMonth, months, churnPct = 0) {
  const rows2 = [{ month: 0, mrr: startMrr }];
  let mrr = startMrr, total = startMrr;
  for (let m = 1; m <= months; m++) {
    const net = mrr * (1 + growthPctPerMonth / 100) - mrr * (churnPct / 100);
    mrr = net;
    rows2.push({ month: m, mrr });
    total += mrr;
  }
  const cagrPct = startMrr > 0 && months > 0 ? (Math.pow(mrr / startMrr, 12 / months) - 1) * 100 : 0;
  return { rows: rows2, exitMrr: mrr, exitArr: mrr * 12, totalBooked: total, cagrPct };
}
var GROWTH_TOOLS = [
  {
    id: "unit-economics",
    domain: "growth",
    label: "Unit economics",
    blurb: "Lifetime value, the ratio that matters, and the months before a customer repays.",
    fields: [
      num("arpu", "Revenue per account / month", "1200"),
      num("margin", "Gross margin (%)", "78"),
      num("cac", "Acquisition cost per account", "9000"),
      num("churn", "Monthly churn (%)", "1.8")
    ],
    run: (v) => {
      const u = unitEconomics(number(v, "arpu", 1200), number(v, "margin", 78), number(v, "cac", 9e3), number(v, "churn", 1.8));
      return {
        headline: `LTV ${u.ltv.toFixed(0)} \xB7 ${u.ltvCac.toFixed(1)}:1 \xB7 payback ${u.paybackMonths.toFixed(1)} months`,
        ok: u.ltvCac >= 3 && u.paybackMonths <= 18,
        kpis: [
          { value: u.grossMarginPerMonth.toFixed(0), label: "margin / month" },
          { value: u.ltv.toFixed(0), label: "lifetime value" },
          { value: `${u.ltvCac.toFixed(1)}:1`, label: "LTV : CAC" },
          { value: `${u.paybackMonths.toFixed(1)} mo`, label: "payback" }
        ],
        lines: [u.verdict, ...u.caveats],
        basis: "LTV = monthly gross margin \xF7 monthly churn (a perpetuity: it assumes a constant churn rate and no expansion revenue); payback = CAC \xF7 monthly gross margin"
      };
    }
  },
  {
    id: "funnel",
    domain: "growth",
    label: "Funnel",
    blurb: "Stage-by-stage conversion, and where the volume actually goes.",
    fields: [area("counts", "Stage counts, one per line", "12000 visitors\n2400 signups\n900 activated\n260 paid\n180 retained 90 days", "fixed names are fine \u2014 the stage label is positional")],
    run: (v) => {
      const counts = series(v, "counts");
      if (counts.length < 2) return { headline: "A funnel needs at least two stages", ok: false, basis: "one count per line, in order" };
      const stages = ["visitors", "signups", "activated", "paid", "retained"];
      const f2 = funnel(counts, stages);
      return {
        headline: `${f2.overall.toFixed(2)}% end to end \u2014 worst step: ${f2.worst?.stage ?? "\u2014"} at ${f2.worst?.fromPrevious.toFixed(1) ?? "0"}%`,
        ok: f2.overall > 1,
        kpis: [
          { value: `${counts[0]}`, label: "entered" },
          { value: `${counts[counts.length - 1]}`, label: "completed" },
          { value: `${f2.overall.toFixed(2)}%`, label: "end to end" },
          { value: f2.worst ? `${f2.worst.drop}` : "\u2014", label: "biggest single drop" }
        ],
        table: {
          head: ["Stage", "Count", "From previous", "From top"],
          rows: f2.steps.map((s, i) => [s.stage === stages[i] ? s.stage : `step ${i + 1}`, `${s.count}`, i === 0 ? "\u2014" : `${s.fromPrevious.toFixed(1)}%`, `${s.fromTop.toFixed(1)}%`])
        },
        lines: [
          f2.worst ? `The largest proportional loss is at ${f2.worst.stage} (${f2.worst.fromPrevious.toFixed(1)}% carried through), costing ${f2.worst.drop.toLocaleString()} \u2014 that is where the next experiment belongs, not at the widest step.` : "No step stands out as the weak link.",
          "A funnel is a sequence, not a set: the counts must be nested (each stage a subset of the one before), or the percentages are meaningless."
        ],
        basis: "conversion computed stage-to-stage and from the top; labels are positional"
      };
    }
  },
  {
    id: "rice",
    domain: "growth",
    label: "RICE",
    blurb: "Scores a backlog the way the framework intends \u2014 with confidence as a discount, not a vote.",
    fields: [
      num("reach", "Reach (users / quarter)", "800"),
      num("impact", "Impact (0.25 \u2013 3)", "2"),
      num("confidence", "Confidence (%)", "80"),
      num("effort", "Effort (person-weeks)", "6"),
      area("others", "Other candidates", "Onboarding rewrite, 1200, 2, 70, 10\nBulk import, 300, 3, 90, 4\nPricing page test, 2000, 1, 60, 2", "name, reach, impact, confidence, effort")
    ],
    run: (v) => {
      const reach = number(v, "reach", 800), impact = number(v, "impact", 2);
      const confidence = number(v, "confidence", 80), effort = number(v, "effort", 6);
      const score = riceScore(reach, impact, confidence, effort);
      const others = str(v, "others").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
        const [name, r, i, c, e] = l.split(/\s*,\s*/);
        return { name: name ?? l, score: riceScore(Number(r), Number(i), Number(c), Number(e)), effort: Number(e) };
      }).filter((o) => Number.isFinite(o.score));
      const ranked = [...others, { name: "(this candidate)", score, effort }].sort((a, b) => b.score - a.score);
      return {
        headline: `RICE ${score.toFixed(1)} \u2014 rank ${ranked.findIndex((r) => r.name === "(this candidate)") + 1} of ${ranked.length}`,
        ok: true,
        kpis: [
          { value: score.toFixed(1), label: "RICE score" },
          { value: `${reach} \xD7 ${impact} \xD7 ${confidence}%`, label: "reach \xD7 impact \xD7 confidence" },
          { value: `${effort}`, label: "effort (person-weeks)" }
        ],
        table: {
          head: ["Candidate", "RICE", "Effort (weeks)", "Score per week"],
          rows: ranked.map((r) => [r.name, r.score.toFixed(1), `${r.effort}`, r.effort > 0 ? (r.score / r.effort).toFixed(2) : "\u2014"])
        },
        lines: [
          "RICE is a sorting device, not a decision \u2014 it makes the inputs explicit so that a disagreement about the ranking can be traced to a number somebody chose.",
          "Confidence is a discount on the estimate, not a vote for the idea: 50% confidence is half the score, which is the framework working as intended."
        ],
        basis: "(reach \xD7 impact \xD7 confidence%) \xF7 effort \u2014 the Intercom formulation; impact uses the 0.25/0.5/1/2/3 scale and effort is person-weeks"
      };
    }
  },
  {
    id: "growth-model",
    domain: "growth",
    label: "Growth model",
    blurb: "What a monthly growth rate compounds to, net of churn, over a stated horizon.",
    fields: [
      num("start", "Starting MRR", "40000"),
      num("growth", "Gross growth (% / month)", "12"),
      num("churn", "Monthly churn (%)", "1.5"),
      num("months", "Months", "24")
    ],
    run: (v) => {
      const months = Math.max(1, Math.min(120, Math.round(number(v, "months", 24))));
      const g = growthModel(number(v, "start", 4e4), number(v, "growth", 12), months, number(v, "churn", 1.5));
      const kpis = [
        { value: g.exitMrr.toFixed(0), label: `MRR at month ${months}` },
        { value: g.exitArr.toFixed(0), label: "exit ARR" },
        { value: `${g.cagrPct.toFixed(1)}%`, label: "implied annual growth" },
        { value: g.totalBooked.toFixed(0), label: "cumulative MRR booked" }
      ];
      return {
        headline: `MRR ${number(v, "start", 4e4).toFixed(0)} \u2192 ${g.exitMrr.toFixed(0)} in ${months} months`,
        ok: true,
        kpis,
        table: { head: ["Month", "MRR"], rows: g.rows.filter((r) => r.month % Math.max(1, Math.round(months / 8)) === 0).map((r) => [`${r.month}`, r.mrr.toFixed(0)]) },
        lines: [
          `A ${number(v, "growth", 12)}% monthly gross rate against ${number(v, "churn", 1.5)}% churn is a net ${(number(v, "growth", 12) - number(v, "churn", 1.5)).toFixed(1)}% \u2014 the churn is applied to the whole base, so it grows in absolute terms as the base grows.`,
          "Compounding is unforgiving in both directions: halving the net rate roughly doubles the time to reach the same MRR, which is why the churn number deserves more attention than the growth number in most plans."
        ],
        basis: "month-by-month compounding: MRR\u2099 = MRR\u2099\u208B\u2081 \xD7 (1 + growth) \u2212 MRR\u2099\u208B\u2081 \xD7 churn; acquisition is modelled as a percentage of the existing base rather than a fixed number of new accounts, so this is a curve, not a plan"
      };
    }
  }
];

// src/specialists/roster.ts
var A = (a) => a;
var SPECIALISTS = Object.freeze([
  /* ── frontend ───────────────────────────────────────────────────────────── */
  A({
    id: "fe.contrast-audit",
    name: "Contrast Audit",
    domain: "frontend",
    status: "engine",
    engine: "contrastRatio + wcagVerdict",
    inputs: "a token set or a list of foreground/background pairs",
    output: "each pair's ratio and the highest WCAG level it meets",
    purpose: "Check every colour pair in a token set against WCAG so accessibility is a build failure rather than a review comment.",
    requiresApproval: false,
    receipt: "the ratio computed for each pair, the standard applied, and the token set it came from"
  }),
  A({
    id: "fe.token-convert",
    name: "Token Converter",
    domain: "frontend",
    status: "engine",
    engine: "parseColor + toHex",
    inputs: "colours in hex, rgb() or hsl() from a design file",
    output: "every notation a codebase needs, alpha preserved",
    purpose: "Convert design-file colours into the exact strings a stylesheet, a canvas call and a native theme each require.",
    requiresApproval: false,
    receipt: "the source value, the conversions produced, and the alpha handling"
  }),
  A({
    id: "fe.type-scale",
    name: "Type Scale",
    domain: "frontend",
    status: "engine",
    engine: "typeScale",
    inputs: "a base size and a ratio",
    output: "the scale in px and rem",
    purpose: "Generate the type scale a design system is built on, with the rounding decided once instead of per component.",
    requiresApproval: false,
    receipt: "the base, the ratio, and every step produced"
  }),
  A({
    id: "fe.grid-drift",
    name: "Grid Drift",
    domain: "frontend",
    status: "engine",
    engine: "snapToGrid",
    inputs: "spacing values found in a stylesheet",
    output: "off-grid values and the distance to the grid",
    purpose: "Find the spacing values that have drifted off the 4/8px grid before they become a visual rhythm nobody can name.",
    requiresApproval: false,
    receipt: "the values tested, the movement each one requires, and the grid base"
  }),
  A({
    id: "fe.a11y-fix",
    name: "Accessibility Fix Plan",
    domain: "frontend",
    status: "workflow",
    engine: "wcagVerdict",
    inputs: "a contrast audit plus the component inventory",
    output: "a ranked list of token changes that clear the most failures",
    purpose: "Turn a list of failing pairs into the smallest set of token changes that fix the most of them.",
    requiresApproval: true,
    receipt: "the plan, the failures it clears, and the human's decision before any token changed"
  }),
  /* ── dev / release engineering ──────────────────────────────────────────── */
  A({
    id: "dev.release-guard",
    name: "Release Guard",
    domain: "dev",
    status: "engine",
    engine: "satisfiesRange + compareSemver",
    inputs: "the manifest, the lockfile and a proposed version",
    output: "ranges a dependency violates, with each range expanded to its real bounds",
    purpose: "Check a release's dependency ranges before the install fails in CI and somebody reaches for --force.",
    requiresApproval: false,
    receipt: "every range tested, the version tested against it, and the expansion used"
  }),
  A({
    id: "dev.changelog",
    name: "Changelog Composer",
    domain: "dev",
    status: "engine",
    engine: "lintCommit",
    inputs: "a commit range",
    output: "a categorised changelog and the commits it could not parse",
    purpose: "Turn a commit range into a readable changelog and name every commit whose message defeated the parser.",
    requiresApproval: false,
    receipt: "the commits read, what each became in the changelog, and every unparsed one"
  }),
  A({
    id: "dev.retry-shape",
    name: "Retry Shape",
    domain: "dev",
    status: "engine",
    engine: "backoffSchedule",
    inputs: "a retry policy or the values the client implements",
    output: "the real schedule and the total time before giving up",
    purpose: "Show what a retry ladder actually does over time, so a policy that never finishes is caught in review.",
    requiresApproval: false,
    receipt: "the policy as implemented, the schedule produced, and the client timeout compared against it"
  }),
  A({
    id: "dev.schedule-audit",
    name: "Schedule Audit",
    domain: "dev",
    status: "engine",
    engine: "parseCron",
    inputs: "cron expressions from a scheduler",
    output: "next runs, daylight handling and the day-field rule",
    purpose: "Catch the scheduled job that will not fire, or will fire twice, before anyone notices the data is stale.",
    requiresApproval: false,
    receipt: "each expression, the runs computed, and the dialect assumed"
  }),
  A({
    id: "dev.migration-plan",
    name: "Migration Plan",
    domain: "dev",
    status: "workflow",
    engine: "deployRisk",
    inputs: "a schema diff and the deploy plan",
    output: "the ordered steps and the rollback path",
    purpose: "Sequence a schema change so the deploy can be rolled back without losing the data it wrote.",
    requiresApproval: true,
    receipt: "the plan, the rollback path, and the human's approval before anything ran against production"
  }),
  /* ── API ────────────────────────────────────────────────────────────────── */
  A({
    id: "api.limit-fit",
    name: "Rate Limit Fit",
    domain: "api",
    status: "engine",
    engine: "tokenBucketPlan",
    inputs: "the published limit and the client's demand",
    output: "sustainable rate, first rejection and the timeline",
    purpose: "Tell a client team what demand its integration can actually sustain before it meets the limit in production.",
    requiresApproval: false,
    receipt: "the limit, the demand simulated, and the timeline produced from them"
  }),
  A({
    id: "api.payload-budget",
    name: "Payload Budget",
    domain: "api",
    status: "engine",
    engine: "payloadBudget",
    inputs: "a response body",
    output: "size per field and what dominates it",
    purpose: "Find the field that is making a response large while clients pay to download and discard it.",
    requiresApproval: false,
    receipt: "the payload measured, the per-field breakdown, and the compression question left unanswered"
  }),
  A({
    id: "api.idempotency-review",
    name: "Idempotency Review",
    domain: "api",
    status: "engine",
    engine: "checkIdempotencyKey",
    inputs: "the key format the client sends and the retention window",
    output: "entropy, shape issues and the retention mismatch",
    purpose: "Check that a write path's idempotency key is actually unguessable and remembered for long enough to matter.",
    requiresApproval: false,
    receipt: "the key shape measured, the entropy floor, and the retention the server promised"
  }),
  A({
    id: "api.paging-advice",
    name: "Paging Advice",
    domain: "api",
    status: "engine",
    engine: "paginationPlan",
    inputs: "row counts, page size and the offset pattern in use",
    output: "page arithmetic and whether the offset is deep enough to hurt",
    purpose: "Say when offset paging stops being fine, and what a keyset cursor would cost instead.",
    requiresApproval: false,
    receipt: "the arithmetic, the depth observed, and the recommendation with its reason"
  }),
  A({
    id: "api.contract-change",
    name: "Contract Change",
    domain: "api",
    status: "workflow",
    engine: "httpSemantics + payloadBudget",
    inputs: "an API diff and the consumer list",
    output: "breaking changes, affected consumers and a deprecation schedule",
    purpose: "Classify an API change as breaking or not, name which consumers it touches, and propose the schedule.",
    requiresApproval: true,
    receipt: "the diff classified, the consumers named, and the human's decision before any deprecation notice went out"
  }),
  /* ── data ───────────────────────────────────────────────────────────────── */
  A({
    id: "data.latency-read",
    name: "Latency Read",
    domain: "data",
    status: "engine",
    engine: "percentile",
    inputs: "a latency series",
    output: "the percentiles with the sample size stated",
    purpose: "Report latency the way users experience it \u2014 at the tail, with the sample size that supports it.",
    requiresApproval: false,
    receipt: "the series, the interpolation method, and every percentile computed"
  }),
  A({
    id: "data.outlier-triage",
    name: "Outlier Triage",
    domain: "data",
    status: "engine",
    engine: "outliersIqr",
    inputs: "a data series",
    output: "fenced values and why the rule may be degenerate here",
    purpose: "Surface the points outside the fences, and say plainly when the sample is too small for the rule to mean anything.",
    requiresApproval: false,
    receipt: "the fences, the points outside them, and the caveats about the sample"
  }),
  A({
    id: "data.experiment-readout",
    name: "Experiment Readout",
    domain: "data",
    status: "engine",
    engine: "abTest + sampleSize",
    inputs: "two arms of a test",
    output: "lift, interval, p-value and the peeking warning",
    purpose: "Read out a test with the uncertainty attached, and refuse to call a result the design could never detect.",
    requiresApproval: false,
    receipt: "the arms, the test used, the interval, and the honesty notes about stopping rules"
  }),
  A({
    id: "data.sample-plan",
    name: "Sample Plan",
    domain: "data",
    status: "engine",
    engine: "sampleSize",
    inputs: "a baseline rate and the effect worth detecting",
    output: "trials per arm and the time that implies",
    purpose: "Size a test before it starts, so the decision is made on the power of the design rather than the patience of the team.",
    requiresApproval: false,
    receipt: "the baseline, the effect, the power and alpha chosen, and the sample derived"
  }),
  A({
    id: "data.metric-definition",
    name: "Metric Definition",
    domain: "data",
    status: "workflow",
    engine: "percentile + stddev",
    inputs: "a metric name, its proposed definition and the events available",
    output: "a definition with its exclusions and its failure modes",
    purpose: "Write down what a metric means \u2014 including the cases it excludes \u2014 before it appears on a dashboard.",
    requiresApproval: false,
    receipt: "the definition, the exclusions, and the events it is actually computed from"
  }),
  /* ── security ───────────────────────────────────────────────────────────── */
  A({
    id: "sec.secret-sweep",
    name: "Secret Sweep",
    domain: "security",
    status: "engine",
    engine: "scanSecrets",
    inputs: "a diff, a config or a log sample",
    output: "matched credential patterns, masked, with the false-positive caveat",
    purpose: "Find the credential shapes that have a fixed format \u2014 and state what a pattern scan cannot find.",
    requiresApproval: false,
    receipt: "the patterns tested, the matches found (masked), and the limits of the method"
  }),
  A({
    id: "sec.token-inspect",
    name: "Token Inspect",
    domain: "security",
    status: "engine",
    engine: "jwtInspect",
    inputs: "a JWT from a support ticket",
    output: "claims, expiry and the algorithm in use",
    purpose: "Decode what a token says and when it dies, without ever implying the signature was checked.",
    requiresApproval: false,
    receipt: "the claims decoded, the arithmetic on exp, and the explicit statement that nothing was verified"
  }),
  A({
    id: "sec.header-audit",
    name: "Header Audit",
    domain: "security",
    status: "engine",
    engine: "cspAudit",
    inputs: "a Content-Security-Policy header",
    output: "directives that are doing nothing, by severity",
    purpose: "Name the clauses of a security policy that look protective and are not.",
    requiresApproval: false,
    receipt: "the policy as supplied, every finding, and the checklist it was tested against"
  }),
  A({
    id: "sec.entropy-floor",
    name: "Entropy Floor",
    domain: "security",
    status: "engine",
    engine: "stringEntropyBits",
    inputs: "a candidate key, password or token",
    output: "measured bits and what the measure does not prove",
    purpose: "Measure how much a string actually carries, and be clear that entropy measures the string and not the generator.",
    requiresApproval: false,
    receipt: "the string measured (not stored), the bits, and the interpretation with its limits"
  }),
  A({
    id: "sec.rotation-runbook",
    name: "Rotation Runbook",
    domain: "security",
    status: "workflow",
    engine: "scanSecrets + stringEntropyBits",
    inputs: "a confirmed exposure and the systems that use the credential",
    output: "the revoke \u2192 rotate \u2192 verify sequence and its owners",
    purpose: "Sequence a credential rotation so revoking comes before rotating, and verification comes before the all-clear.",
    requiresApproval: true,
    receipt: "the sequence, the owners, and the human's approval \u2014 rotation touches production credentials"
  }),
  /* ── ops ────────────────────────────────────────────────────────────────── */
  A({
    id: "ops.budget-watch",
    name: "Error Budget Watch",
    domain: "ops",
    status: "engine",
    engine: "sloErrorBudget",
    inputs: "an SLO, a window and consumption so far",
    output: "remaining budget, burn rate and time to exhaust",
    purpose: "Keep the reliability decision a number rather than an argument held during an incident.",
    requiresApproval: false,
    receipt: "the SLO, the window, the consumption observed, and the extrapolation with its assumption stated"
  }),
  A({
    id: "ops.capacity-plan",
    name: "Capacity Plan",
    domain: "ops",
    status: "engine",
    engine: "capacityHeadroom",
    inputs: "current utilisation, growth rate and a ceiling",
    output: "the month the ceiling is crossed and the runway",
    purpose: "Give the launch question a date: when growth meets the ceiling, if nothing changes.",
    requiresApproval: false,
    receipt: "the inputs, the compound curve, and the breach month computed from them"
  }),
  A({
    id: "ops.incident-class",
    name: "Incident Classifier",
    domain: "ops",
    status: "engine",
    engine: "incidentSeverity",
    inputs: "impact numbers from triage",
    output: "an S1\u2013S4 call with the rule that produced it",
    purpose: "Assign severity from impact rather than from who noticed, using a rule that is printed alongside the verdict.",
    requiresApproval: false,
    receipt: "the impact data, the severity, and the rule applied \u2014 printed so it can be argued with"
  }),
  A({
    id: "ops.deploy-gate",
    name: "Deploy Gate",
    domain: "ops",
    status: "engine",
    engine: "deployRisk",
    inputs: "the change, its tests, its rollback and its timing",
    output: "a risk score, the active factors and a recommendation",
    purpose: "Score a deploy against the six factors that turn releases into incidents, and say which one to fix first.",
    requiresApproval: true,
    receipt: "the factors assessed, the score, and the human's go-ahead \u2014 this gate can stop a release"
  }),
  A({
    id: "ops.postmortem",
    name: "Postmortem Drafter",
    domain: "ops",
    status: "workflow",
    engine: "incidentSeverity + sloErrorBudget",
    inputs: "the incident timeline and its impact",
    output: "a blameless timeline, the budget cost and the actions with owners",
    purpose: "Draft the postmortem from the timeline, with the impact measured against the budget it consumed.",
    requiresApproval: false,
    receipt: "the timeline used, the budget arithmetic, and the actions with their owners"
  }),
  /* ── docs ───────────────────────────────────────────────────────────────── */
  A({
    id: "docs.reading-level",
    name: "Reading Level",
    domain: "docs",
    status: "engine",
    engine: "readability",
    inputs: "prose from a page or a README",
    output: "grade level, ease score and the cause",
    purpose: "Keep user-facing documentation at the reading level its audience actually has.",
    requiresApproval: false,
    receipt: "the text measured, the scores, and the syllable-estimation caveat"
  }),
  A({
    id: "docs.len-budget",
    name: "Length Budget",
    domain: "docs",
    status: "engine",
    engine: "readingTime",
    inputs: "a document",
    output: "words, minutes and code lines",
    purpose: "Decide whether a page needs a summary by knowing how long it takes to read.",
    requiresApproval: false,
    receipt: "the word count, the assumed rate, and the code lines counted separately"
  }),
  A({
    id: "docs.structure-check",
    name: "Structure Check",
    domain: "docs",
    status: "engine",
    engine: "headingLint",
    inputs: "markdown",
    output: "level jumps, duplicate anchors, title problems",
    purpose: "Keep headings in a shape that a table of contents and a screen reader can both follow.",
    requiresApproval: false,
    receipt: "the heading tree, every structural issue, and its line number"
  }),
  A({
    id: "docs.terminology-lock",
    name: "Terminology Lock",
    domain: "docs",
    status: "engine",
    engine: "terminologyDrift",
    inputs: "a document set",
    output: "terms written more than one way",
    purpose: "Keep one spelling per concept so search, glossary links and translation keep working.",
    requiresApproval: false,
    receipt: "the variants found with their counts, and the fixed variant list used"
  }),
  A({
    id: "docs.release-notes",
    name: "Release Notes",
    domain: "docs",
    status: "workflow",
    engine: "lintCommit + readability",
    inputs: "a changelog and the audience it serves",
    output: "notes written for users, checked for reading level",
    purpose: "Turn engineering changes into notes a customer can act on, at a reading level they can finish.",
    requiresApproval: true,
    receipt: "the source commits, the notes drafted, and the human's approval before anything was published"
  }),
  /* ── growth ─────────────────────────────────────────────────────────────── */
  A({
    id: "growth.economics",
    name: "Unit Economics",
    domain: "growth",
    status: "engine",
    engine: "unitEconomics",
    inputs: "revenue, margin, acquisition cost and churn",
    output: "lifetime value, the ratio and the payback period",
    purpose: "Answer whether growth pays for itself before more money is spent proving it.",
    requiresApproval: false,
    receipt: "the inputs, the ratio, the payback, and the assumptions the model rests on"
  }),
  A({
    id: "growth.funnel-read",
    name: "Funnel Read",
    domain: "growth",
    status: "engine",
    engine: "funnel",
    inputs: "stage counts in order",
    output: "stage conversions and the largest proportional loss",
    purpose: "Point the next experiment at the step that loses the most, rather than the step with the most traffic.",
    requiresApproval: false,
    receipt: "the counts, each stage's conversion, and the step identified as the constraint"
  }),
  A({
    id: "growth.backlog-rank",
    name: "Backlog Ranker",
    domain: "growth",
    status: "engine",
    engine: "riceScore",
    inputs: "candidate work with reach, impact, confidence and effort",
    output: "a ranked table with the inputs left visible",
    purpose: "Rank a backlog so disagreement can be traced to an input somebody chose, not to seniority.",
    requiresApproval: false,
    receipt: "every candidate scored, the formula used, and the inputs as supplied"
  }),
  A({
    id: "growth.plan-check",
    name: "Plan Check",
    domain: "growth",
    status: "engine",
    engine: "growthModel",
    inputs: "a growth plan with its churn assumption",
    output: "the trajectory, the exit ARR and the implied rate",
    purpose: "Test whether a revenue plan survives its own churn assumption before it is presented.",
    requiresApproval: false,
    receipt: "the plan modelled month by month, the assumed rates, and the exit position"
  }),
  A({
    id: "growth.price-change",
    name: "Price Change",
    domain: "growth",
    status: "workflow",
    engine: "unitEconomics + growthModel",
    inputs: "a proposed price change and the affected base",
    output: "the margin effect, the churn break-even and the affected cohorts",
    purpose: "Model a price change: what it earns, what churn it can absorb, and who it touches.",
    requiresApproval: true,
    receipt: "the model, the break-even churn, and the human's approval \u2014 a price change is customer-facing"
  })
]);
function specialistsByDomain(domain) {
  return SPECIALISTS.filter((s) => s.domain === domain);
}
function findSpecialist(id) {
  return SPECIALISTS.find((s) => s.id === id);
}
function specialistStatus() {
  return {
    total: SPECIALISTS.length,
    engine: SPECIALISTS.filter((s) => s.status === "engine").length,
    workflow: SPECIALISTS.filter((s) => s.status === "workflow").length,
    requiringApproval: SPECIALISTS.filter((s) => s.requiresApproval).length,
    domains: new Set(SPECIALISTS.map((s) => s.domain)).size
  };
}

// src/specialists/index.ts
var TOOLS = Object.freeze([
  ...FRONTEND_TOOLS,
  ...DEV_TOOLS,
  ...API_TOOLS,
  ...DATA_TOOLS,
  ...SECURITY_TOOLS,
  ...OPS_TOOLS,
  ...DOCS_TOOLS,
  ...GROWTH_TOOLS
]);
var DOMAINS = Object.freeze([
  { id: "frontend", label: "Frontend", blurb: "Colour, contrast, type and spacing \u2014 the parts of design that are arithmetic." },
  { id: "dev", label: "Engineering", blurb: "Versions, commits, status codes, retry ladders and schedules." },
  { id: "api", label: "API", blurb: "Rate limits, payload budgets, idempotency keys and paging." },
  { id: "data", label: "Data", blurb: "Percentiles, outliers, experiment readouts and sample sizing." },
  { id: "security", label: "Security", blurb: "Secret shapes, token decoding, headers and entropy \u2014 as measures, not verdicts." },
  { id: "ops", label: "Reliability", blurb: "Error budgets, capacity runway, severity and deploy risk." },
  { id: "docs", label: "Docs", blurb: "Reading level, length, heading structure and terminology drift." },
  { id: "growth", label: "Growth", blurb: "Unit economics, funnels, prioritisation and revenue trajectory." },
  { id: "finance-in", label: "Finance \xB7 India", blurb: "GST, TDS, ITC reconciliation, MSME clocks \u2014 the Munshi pack." }
]);
function toolsForDomain(domain) {
  return TOOLS.filter((t) => t.domain === domain);
}
function toolById(id) {
  return TOOLS.find((t) => t.id === id);
}

// probe/specialists.test.ts
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
function section(name) {
  console.log(`
== ${name}`);
}
section("1. every tool drives from its own defaults, twice, identically");
ok("the pack ships a substantial set of tools", TOOLS.length >= 30, `${TOOLS.length} tools`);
ok("across all nine domains", DOMAINS.length === 9, `${DOMAINS.length} domains`);
var TOOL_DOMAINS = [...new Set(TOOLS.map((t) => t.domain))];
ok(
  "every domain except finance-in has tools of its own",
  TOOL_DOMAINS.length === 8 && !TOOL_DOMAINS.includes("finance-in"),
  TOOL_DOMAINS.join(" \xB7 ")
);
var toolFailures = [];
var nondeterministic = [];
var missingBasis = [];
for (const t of TOOLS) {
  const defaults = Object.fromEntries(t.fields.map((f2) => [f2.key, f2.def]));
  try {
    const a = t.run(defaults);
    const b = t.run(defaults);
    if (JSON.stringify(a) !== JSON.stringify(b)) nondeterministic.push(t.id);
    if (!a.headline || a.headline.length < 5) toolFailures.push(`${t.id}: empty headline`);
    if (!a.basis || a.basis.length < 20) missingBasis.push(t.id);
  } catch (e) {
    toolFailures.push(`${t.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
ok("every tool runs on its declared defaults without throwing", toolFailures.length === 0, toolFailures.slice(0, 4).join(" | "));
ok("every tool is deterministic \u2014 two runs are byte-identical", nondeterministic.length === 0, nondeterministic.join(", "));
ok("every tool states the rule or formula behind its answer", missingBasis.length === 0, missingBasis.join(", "));
ok("every tool declares at least one field", TOOLS.every((t) => t.fields.length > 0));
ok("tool ids are unique", new Set(TOOLS.map((t) => t.id)).size === TOOLS.length);
ok(
  "every field has a default that matches its kind",
  TOOLS.every((t) => t.fields.every((f2) => f2.kind === "toggle" ? typeof f2.def === "boolean" : typeof f2.def === "string"))
);
ok(
  "a domain's tools are reachable by domain",
  toolsForDomain("dev").length === 5 && toolById("contrast")?.domain === "frontend"
);
section("2. frontend \u2014 WCAG's own published numbers");
ok(
  "black on white is the maximum 21:1",
  contrastRatio(parseColor("#000000"), parseColor("#ffffff")) === 21
);
var grey = contrastRatio(parseColor("#777777"), parseColor("#ffffff"));
ok("WCAG's worked example #777 on white is 4.48:1", Math.abs(grey - 4.48) < 0.01, grey.toFixed(4));
ok("and it is graded as failing AA for body text", !wcagVerdict(grey).aaNormal && wcagVerdict(grey).aaLarge);
ok("7:1 passes AAA for body text", wcagVerdict(7).aaaNormal);
ok("identical colours are 1:1", contrastRatio(parseColor("#123456"), parseColor("#123456")) === 1);
ok("shorthand hex expands", parseColor("#abc").r === 170 && parseColor("#abc").g === 187);
ok("rgb() is read", parseColor("rgb(1, 2, 3)").b === 3);
ok("hsl() is read", parseColor("hsl(0, 100%, 50%)").r === 255);
ok("alpha is preserved from an 8-digit hex", Math.abs(parseColor("#00000080").a - 0.502) < 0.01);
ok("an unreadable colour is refused, not approximated", parseColor("cornflowerblue") === null);
ok("hex round-trips", toHex(parseColor("#D5B26B")) === "#d5b26b");
var scale = typeScale(16, 1.25, 6);
ok(
  "a 16px / 1.25 scale produces whole and quarter-pixel steps",
  scale.every((s) => s.px * 4 % 1 === 0),
  scale.map((s) => s.px).join(", ")
);
ok("the base step is exactly the base size", scale.some((s) => s.step === 0 && s.px === 16));
ok("rem is px over 16", scale.every((s) => Math.abs(s.rem - s.px / 16) < 1e-3));
var snap = snapToGrid([4, 10, 16, 24, 30, 40, 55], 8);
ok(
  "off-grid values are snapped and the movement reported",
  snap.onGrid === 3 && snap.worst === 4,
  `onGrid=${snap.onGrid} worst=${snap.worst}`
);
section("3. engineering \u2014 versions, commits, statuses, ladders, cron");
ok(
  "a prerelease sorts BELOW its release",
  compareSemver(parseSemver("1.4.2-rc.3"), parseSemver("1.4.2")) === -1
);
ok(
  "numeric identifiers compare numerically, not as strings",
  compareSemver(parseSemver("1.0.0-rc.10"), parseSemver("1.0.0-rc.9")) === 1
);
ok(
  "build metadata is ignored in precedence",
  compareSemver(parseSemver("1.0.0+a"), parseSemver("1.0.0+b")) === 0
);
ok("a caret range admits 1.4.2 for ^1.2.0", satisfiesRange(parseSemver("1.4.2"), "^1.2.0").ok);
ok("and refuses 2.0.0", !satisfiesRange(parseSemver("2.0.0"), "^1.2.0").ok);
ok("a tilde range stops at the minor", satisfiesRange(parseSemver("1.2.9"), "~1.2.0").ok && !satisfiesRange(parseSemver("1.3.0"), "~1.2.0").ok);
ok(
  "the range is expanded so the answer is checkable",
  satisfiesRange(parseSemver("1.4.2"), "^1.2.0").expanded.some((e) => e.includes(">=1.2.0")),
  satisfiesRange(parseSemver("1.4.2"), "^1.2.0").expanded.join(" | ")
);
ok("unions work", satisfiesRange(parseSemver("1.1.0"), "2.x || 1.x").ok);
ok("bumping rolls the right digit", nextVersion(parseSemver("1.4.2"), "major") === "2.0.0" && nextVersion(parseSemver("1.4.2"), "minor") === "1.5.0" && nextVersion(parseSemver("1.4.2"), "patch") === "1.4.3");
ok("a prerelease bump increments the last number", nextVersion(parseSemver("1.4.2-rc.3"), "prerelease") === "1.4.2-rc.4");
ok("a nonsense version is refused", parseSemver("1.4") === null);
ok(
  "a clean conventional commit has no errors",
  lintCommit("feat(auth): add device-bound session keys").errors.length === 0
);
ok("a missing type is an error", lintCommit("Fixed some stuff.").errors.length > 0);
ok("an unknown type is caught", lintCommit("wibble: something").errors.some((e) => e.includes("not a conventional type")));
ok(
  "a body glued to the subject is caught",
  lintCommit("fix: thing\nthis line should have been blank").errors.some((e) => e.includes("second line must be blank"))
);
ok(
  "a BREAKING CHANGE footer marks the commit",
  lintCommit("feat: change\n\nBREAKING CHANGE: the field moved").breaking === true
);
ok(
  "over-length descriptions are caught",
  lintCommit(`feat: ${"x".repeat(80)}`).errors.some((e) => e.includes("72"))
);
ok(
  "504 is retryable but only for an idempotent request",
  httpSemantics(504).retry === "yes" && httpSemantics(504).idempotentSafe.includes("idempotent")
);
ok("404 is never retryable", httpSemantics(404).retry === "no");
ok("an unassigned code is unclassified rather than guessed", httpSemantics(599).known === false);
var ladder = backoffSchedule(5, 200, 2, 3e4);
ok(
  "the ladder doubles and totals 6.2s",
  ladder.rows.map((r) => r.delayMs).join(",") === "200,400,800,1600,3200" && ladder.human === "6.2s",
  `${ladder.rows.map((r) => r.delayMs).join(",")} / ${ladder.human}`
);
var capped = backoffSchedule(8, 1e3, 3, 1e4);
ok("the cap binds and is reported", capped.rows.some((r) => r.delayMs === 1e4));
ok(
  "the ladder is deterministic \u2014 jitter is a fixed permille, not randomness",
  JSON.stringify(backoffSchedule(4, 100, 2, 9999, 100)) === JSON.stringify(backoffSchedule(4, 100, 2, 9999, 100))
);
var cron = parseCron("0 3 * * 1", "2026-09-22", 3);
ok("a weekly 03:00 Monday job parses", cron.valid && cron.errors.length === 0);
ok("and its next run is the following Monday", cron.next[0] === "2026-09-28 03:00", cron.next.join(" | "));
ok(
  "a six-field expression is refused with the dialect named",
  !parseCron("0 0 3 * * 1", "2026-09-22").valid && parseCron("0 0 3 * * 1", "2026-09-22").errors[0].includes("exactly 5")
);
ok("an out-of-range value is refused", !parseCron("0 25 * * *", "2026-09-22").valid);
var both = parseCron("0 0 1 * 1", "2026-09-22", 8);
ok(
  "both day fields restricted means either day fires the job",
  both.next.some((d) => d.endsWith("-28 00:00")) && both.next.some((d) => d.includes("-01 00:00")),
  both.next.join(" | ")
);
section("4. API \u2014 limits, payloads, keys, paging");
var bucket = tokenBucketPlan(600, 20, 15, 30);
ok("a 10/s refill cannot sustain 15/s demand", bucket.steadyState === 10);
ok("the burst absorbs two seconds before the limit bites", bucket.firstRejection === 3, String(bucket.firstRejection));
ok(
  "and the refill is a per-SECOND rate, which is the part people miss",
  tokenBucketPlan(60, 5, 2, 10).steadyState === 1
);
var small = payloadBudget('{"a":1}');
ok("a payload is measured in UTF-8 bytes as the wire sees it", small.totalBytes === 7, String(small.totalBytes));
var big = payloadBudget('{"id":"x","notes":"' + "n".repeat(300) + '"}');
ok("the dominant field is named", big.largest?.field === "notes", String(big.largest?.field));
ok(
  "invalid JSON is refused with the parse error",
  payloadBudget("{not json}").ok === false && (payloadBudget("{not json}").error ?? "").includes("not valid JSON")
);
var key = checkIdempotencyKey("3f8a1c9b-6d2e-4f71-9a55-2c7e8b0d4e13");
ok("a UUIDv4 is accepted and recognised as such", key.ok && key.charset === "uuid");
ok("a short, human-typed key is refused", !checkIdempotencyKey("dev-key-1").ok && checkIdempotencyKey("dev-key-1").issues.some((i) => i.includes("too short")));
ok("entropy is measured, not asserted", stringEntropyBits("aaaaaaaa") === 0 && stringEntropyBits("abcd") === 8);
var paging = paginationPlan(25e4, 100, 25e3, 1e4);
ok("page arithmetic is exact", paging.pages === 2500 && paging.lastPageSize === 100);
ok("deep paging is called out with the reason", paging.deep && paging.lines.some((l) => l.includes("keyset")));
ok("a shallow offset is not flagged", !paginationPlan(500, 25, 50).deep);
section("5. data \u2014 the statistics, checked against known values");
ok("the median of an even set interpolates", percentile([1, 2, 3, 4], 50) === 2.5);
ok("the median of an odd set is the middle", percentile([1, 2, 3, 4, 5], 50) === 3);
ok(
  "p0 and p100 are the extremes of a sorted series",
  percentile([1, 5, 9], 0) === 1 && percentile([1, 5, 9], 100) === 9
);
ok(
  "percentiles() sorts for the caller, so an unsorted series still measures correctly",
  percentiles([5, 1, 9], [50])[0].value === 5
);
ok("one point is its own percentile", percentile([42], 95) === 42);
var fence = outliersIqr([10, 11, 12, 12, 13, 13, 14, 15, 16, 17, 18, 120]);
ok("Tukey's fences find the single outlier", fence.outliers.join(",") === "120", fence.outliers.join(","));
ok(
  "the fences are computed from interpolated quartiles",
  Math.abs(fence.q1 - 12) < 1e-3 && Math.abs(fence.upperFence - 22.625) < 1e-3,
  `q1=${fence.q1} fence=${fence.upperFence}`
);
ok(
  "a degenerate quartile spread is reported as degenerate",
  outliersIqr([5, 5, 5, 5, 5, 5, 5, 5, 5, 99]).whys.some((w) => w.includes("degenerate"))
);
var exp = abTest(5e3, 400, 5e3, 452);
ok("the observed rates are exact", Math.abs(exp.rateA - 8) < 1e-9 && Math.abs(exp.rateB - 9.04) < 1e-9);
ok("a +13% relative lift is measured", Math.abs(exp.liftPct - 13) < 0.05, exp.liftPct.toFixed(3));
ok("and at this sample size it is NOT yet significant", !exp.significant95, `p=${exp.p.toFixed(4)}`);
ok(
  "the interval spans zero exactly when the test is not significant",
  exp.ciLowPct < 0 && exp.ciHighPct > 0,
  `${exp.ciLowPct.toFixed(2)} \u2026 ${exp.ciHighPct.toFixed(2)}`
);
ok("the peeking warning is always attached", exp.guardrails.some((g) => g.includes("peeking")));
ok(
  "a tiny arm is flagged as too small for this test",
  abTest(40, 3, 40, 5).guardrails.some((g) => g.includes("fewer than 100 trials"))
);
var n = sampleSize(8, 10, 0.8, 0.05);
ok("the two-proportion sample size matches this implementation's formula", n === 18878, String(n));
ok(
  "halving the effect roughly quadruples the sample",
  Math.abs(sampleSize(8, 5, 0.8, 0.05) / n - 3.9) < 0.4,
  `${sampleSize(8, 5, 0.8, 0.05)} vs ${n}`
);
section("6. security \u2014 and the limits each tool admits");
var hits = scanSecrets("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nDATABASE_URL=postgres://app:hunter2@db.internal:5432/prod");
ok("an AWS key id is found by its fixed prefix", hits.some((h) => h.name === "AWS access key id"));
ok("a connection string with an embedded password is found", hits.some((h) => h.name === "Connection string"));
ok(
  "matches are masked, so a finding is not a second copy of the secret",
  hits.every((h) => h.samples.every((s) => s.includes("\u2022")))
);
ok("a private key block is found", scanSecrets("-----BEGIN RSA PRIVATE KEY-----\nMIIE").some((h) => h.name === "Private key block"));
ok(
  "clean text yields nothing \u2014 and the tool says that is not a clean bill of health",
  scanSecrets("just some ordinary prose").length === 0
);
var tool = toolById("secrets");
var scanResult = tool.run({ ...Object.fromEntries(tool.fields.map((f2) => [f2.key, f2.def])) });
ok(
  "the scan result states what it cannot find",
  (scanResult.lines ?? []).some((l) => l.includes("does NOT find")),
  "the limits must be printed, not implied"
);
var jwt = jwtInspect("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhY2N0XzlmMiIsImF1ZCI6ImFwaS5leGFtcGxlLmNvbSIsImV4cCI6MTc5MDAwMDAwMH0.sig", "2026-09-22");
ok("a JWT decodes to its claims", jwt.ok && jwt.payload?.sub === "acct_9f2", JSON.stringify(jwt.payload));
ok("the algorithm is reported", jwt.algorithm === "HS256");
ok(
  "and the tool states plainly that nothing was verified",
  jwt.lines.some((l) => l.includes("NOT verified")),
  jwt.lines.join(" | ").slice(0, 90)
);
var none = jwtInspect("eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.", "2026-09-22");
ok("alg=none is called out as unsigned authority", none.algorithm === "none" && none.lines.some((l) => l.includes("NO signature")));
ok("a token with no exp is a finding", none.lines.some((l) => l.includes("never expires")));
ok("a malformed token is refused", !jwtInspect("not.a.jwt", "2026-09-22").ok);
var csp = cspAudit("default-src 'self'; script-src 'self' 'unsafe-inline'; img-src *", false);
ok(
  "unsafe-inline without a nonce is a high finding",
  csp.findings.some((f2) => f2.severity === "high" && f2.finding.includes("unsafe-inline"))
);
ok("a wildcard source is a high finding", csp.findings.some((f2) => f2.directive === "*"));
ok("a missing base-uri is flagged", csp.findings.some((f2) => f2.directive === "base-uri"));
ok(
  "a policy with a nonce is not flagged for inline",
  !cspAudit("default-src 'self'; script-src 'self' 'unsafe-inline' 'nonce-abc'", true).findings.some((f2) => f2.finding.includes("unsafe-inline"))
);
section("7. reliability \u2014 budgets, runways, severity, deploy risk");
var budget = sloErrorBudget(99.9, 30, 35);
ok(
  "a 99.9% SLO over 30 days allows 43.2 minutes",
  Math.abs(budget.allowedDownMinutes - 43.2) < 1e-9,
  budget.allowedDownMinutes.toFixed(3)
);
ok(
  "the remaining budget is the arithmetic remainder",
  Math.abs(budget.remainingMinutes - 28.08) < 1e-9,
  budget.remainingMinutes.toFixed(3)
);
ok("a spent budget is stated as breached", sloErrorBudget(99.9, 30, 120).state.includes("exhausted"));
ok(
  "a 99% SLO is far more permissive than 99.9%",
  Math.abs(sloErrorBudget(99, 30, 0).allowedDownMinutes - 432) < 1e-9
);
var runway = capacityHeadroom(42, 6, 80, 24);
ok("compound growth crosses an 80% ceiling in month 12", runway.breachMonth === 12, String(runway.breachMonth));
ok("flat growth never breaches", capacityHeadroom(42, 0, 80, 24).breachMonth === null);
ok("a 12% user impact with a workaround is S3", incidentSeverity(12, 1, false, true).severity === "S3");
ok("the same impact without a workaround is S2", incidentSeverity(12, 1, false, false).severity === "S2");
ok("data loss is always S1", incidentSeverity(1, 0, true, true).severity === "S1");
ok("trivial impact is S4", incidentSeverity(0.5, 0, false, true).severity === "S4");
ok("the rules are printed with the verdict", incidentSeverity(1, 0, true, true).rules.length === 4);
var risk = deployRisk(23, false, true, true, false, true);
ok("a clean deploy with a wide diff and peak timing scores 18", risk.score === 18, String(risk.score));
ok(
  "a failing test suite alone outweighs everything else",
  deployRisk(5, false, false, true, true, true).score === 30
);
ok("a fully addressed deploy scores zero", deployRisk(3, false, true, true, true, true).score === 0);
ok("the score comes with the factors that produced it", risk.factors.length === 6 && risk.recommendation.length > 20);
section("8. docs \u2014 readability against the published formulas");
ok("syllables are estimated by vowel groups", syllables("steward") === 2 && syllables("the") === 1);
var prose = readability("The cat sat on the mat. The dog ran fast. A bird flew away.");
ok("Flesch-Kincaid is finite and low on simple prose", prose.fleschKincaidGrade < 4, String(prose.fleschKincaidGrade));
ok("the sentence count is right", prose.sentences === 3, String(prose.sentences));
ok(
  "code blocks are excluded from the prose measure",
  readability("Short words here.\n```\ncomplicated_identifier.with.many.parts()\n```").avgWordSyllables < 2
);
var long = readability(`${"magnificent extraordinary implementation ".repeat(20)}.`);
ok("dense prose scores a higher grade", long.fleschKincaidGrade > 12, String(long.fleschKincaidGrade));
ok(
  "reading time is words over the rate",
  Math.abs(readingTime("word ".repeat(400), 200).minutes - 2) < 0.01
);
ok("code lines are counted separately", readingTime("text\n```\na\nb\nc\n```").codeLines === 3);
var headings = headingLint("# Title\n\n### Skipped\n\n# Second title");
ok("a skipped heading level is caught", headings.issues.some((i) => i.issue.includes("jumps from h1 to h3")));
ok("two h1 headings are caught", headings.issues.some((i) => i.issue.includes("h1 headings")));
ok(
  "duplicate headings are caught",
  headingLint("# A\n\n## Same\n\n## Same").issues.some((i) => i.issue.includes("duplicate"))
);
ok("a clean document reports nothing", headingLint("# A\n\n## B\n\n### C").issues.length === 0);
var drift = terminologyDrift("The Kubernetes cluster is live. Developers use the Kubernetes API. Another kubernetes note. One more kubernetes mention.");
ok("casing drift on a repeated term is caught", drift.some((d) => d.term === "kubernetes"));
ok(
  "hyphenation variants are caught when both forms appear",
  terminologyDrift("Send an e-mail. Then send email. Another e-mail follows.").some((d) => d.term === "email")
);
ok("consistent text reports nothing", terminologyDrift("The email was sent. The email arrived.").length === 0);
section("9. growth \u2014 the ratios a business is run on");
var econ = unitEconomics(1200, 78, 9e3, 1.8);
ok("lifetime value is margin over churn", Math.abs(econ.ltv - 52e3) < 1, econ.ltv.toFixed(2));
ok("the ratio is computed against acquisition cost", Math.abs(econ.ltvCac - 5.777) < 0.01, econ.ltvCac.toFixed(3));
ok("payback is acquisition cost over monthly margin", Math.abs(econ.paybackMonths - 9.615) < 0.01, econ.paybackMonths.toFixed(3));
ok(
  "zero churn is called out as a modelling artefact",
  unitEconomics(1e3, 80, 5e3, 0).caveats.some((c) => c.includes("infinite"))
);
ok(
  "negative economics are stated as such",
  unitEconomics(100, 50, 9e3, 5).verdict.includes("Negative unit economics")
);
var f = funnel([12e3, 2400, 900, 260, 180], ["a", "b", "c", "d", "e"]);
ok("end-to-end conversion is top over bottom", Math.abs(f.overall - 1.5) < 1e-9, f.overall.toFixed(4));
ok("the worst step is the one with the lowest carry-through", f.worst?.stage === "b", String(f.worst?.stage));
ok("stage-to-stage conversion is exact", Math.abs(f.steps[1].fromPrevious - 20) < 1e-9);
ok(
  "RICE is reach \xD7 impact \xD7 confidence \xF7 effort",
  Math.abs(riceScore(800, 2, 80, 6) - 213.333) < 0.01,
  riceScore(800, 2, 80, 6).toFixed(3)
);
ok("zero effort cannot divide", riceScore(100, 1, 100, 0) === 0);
var model = growthModel(4e4, 12, 24, 1.5);
ok("the trajectory is computed month by month", model.rows.length === 25);
ok(
  "net growth is growth minus churn",
  model.exitMrr > 4e4 * Math.pow(1.105, 24) && model.exitMrr < 4e4 * Math.pow(1.106, 24),
  model.exitMrr.toFixed(0)
);
ok("exit ARR is twelve times exit MRR", Math.abs(model.exitArr - model.exitMrr * 12) < 1e-6);
section("10. the roster holds itself to its own claims");
var status = specialistStatus();
ok("the generalist pack ships forty specialists", status.total === 40, String(status.total));
ok("across eight domains", status.domains === 8, String(status.domains));
ok("an id is unique per specialist", new Set(SPECIALISTS.map((s) => s.id)).size === status.total);
ok(
  "every specialist declares a purpose and a receipt",
  SPECIALISTS.every((s) => s.purpose.length > 40 && s.receipt.length > 20)
);
var exported = new Set(Object.keys(specialists_exports));
var allowed = /* @__PURE__ */ new Set(["all"]);
var missing = [];
for (const s of SPECIALISTS) {
  for (const part of s.engine.split(/[+,]/)) {
    const lead = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (!lead) continue;
    if (!exported.has(lead[1]) && !allowed.has(lead[1])) missing.push(`${s.id} \u2192 ${lead[1]}`);
  }
}
ok("every engine a specialist claims exists in the pack", missing.length === 0, missing.slice(0, 5).join(", "));
var MUST_BE_GATED = /^(ops\.deploy-gate|ops\.change|dev\.migration|sec\.rotation|growth\.price|docs\.release|api\.contract|fe\.a11y)/;
var gatedIds = SPECIALISTS.filter((s) => s.requiresApproval).map((s) => s.id);
var ungatedDestructive = SPECIALISTS.filter((s) => MUST_BE_GATED.test(s.id) && !s.requiresApproval).map((s) => s.id);
ok(
  "specialists that change production, spend money or touch customers are gated",
  ungatedDestructive.length === 0,
  ungatedDestructive.join(", ")
);
ok("and the gate is a real set, not a single token", gatedIds.length === 7, `${gatedIds.length}: ${gatedIds.join(", ")}`);
ok(
  "a read-only audit is NOT gated, because a gate that always fires is noise",
  SPECIALISTS.filter((s) => /(audit|sweep|inspect|read|check|watch|scan)/i.test(s.id)).every((s) => !s.requiresApproval),
  SPECIALISTS.filter((s) => /(audit|sweep|inspect|read|check|watch|scan)/i.test(s.id) && s.requiresApproval).map((s) => s.id).join(", ")
);
ok(
  "every domain has at least four specialists",
  DOMAINS.filter((d) => d.id !== "finance-in").every((d) => specialistsByDomain(d.id).length >= 4),
  DOMAINS.filter((d) => d.id !== "finance-in").map((d) => `${d.id}:${specialistsByDomain(d.id).length}`).join(" ")
);
ok("findSpecialist resolves an id", findSpecialist("ops.deploy-gate")?.requiresApproval === true);
ok(
  "the finance pack is listed as a domain of this pack, not copied into it",
  DOMAINS.some((d) => d.id === "finance-in" && d.label.includes("India"))
);
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f2 of failures) console.log(`  - ${f2}`);
}
process.exit(failed > 0 ? 1 : 0);
