import { readFileSync } from "fs";
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
function oklchToRgb(l, c, hd) {
  const h = (hd * Math.PI) / 180;
  const a = c * Math.cos(h), bb = c * Math.sin(h);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = l - 0.0894841775 * a - 1.291485548 * bb;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map(clamp01);
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  return lin.map((v) => Math.round(clamp01(enc(v)) * 255));
}
const hex = (a) => "#" + a.map((n) => n.toString(16).padStart(2, "0")).join("");
const css = readFileSync("node_modules/tailwindcss/theme.css", "utf8");
const P = {};
for (const m of css.matchAll(/--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\)/g)) {
  const [, hue, shade, l, c, h] = m;
  P[`${hue}-${shade}`] = hex(oklchToRgb(parseFloat(l) > 1 ? parseFloat(l) / 100 : parseFloat(l), +c, +h));
}
const lum = (hx) => {
  const r = parseInt(hx.slice(1, 3), 16), g = parseInt(hx.slice(3, 5), 16), b = parseInt(hx.slice(5, 7), 16);
  const ch = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const cr = (a, b) => { const x = lum(a), y = lum(b); const hi = Math.max(x, y), lo = Math.min(x, y); return (hi + 0.05) / (lo + 0.05); };
const f = (n) => (Math.floor(n * 100) / 100).toFixed(2);
const CARD = "#242424", BG = "#1a1a1a";
console.log("--- candidate marks on card #242424 / background #1a1a1a (need 3.0) ---");
for (const k of ["red-300","red-400","red-500","rose-400","orange-400","amber-300","amber-400","amber-500","yellow-400","green-400","green-500","emerald-400","sky-400","blue-400","blue-500","cyan-400","violet-400","purple-400","neutral-400","zinc-400"]) {
  if (!P[k]) { console.log(k, "MISSING"); continue; }
  console.log(k.padEnd(12), P[k], "card", f(cr(P[k], CARD)), "bg", f(cr(P[k], BG)));
}
console.log("--- candidate chip pairs (need 4.5) ---");
for (const [bgk, fgk] of [["red-100","red-900"],["red-200","red-900"],["amber-100","amber-900"],["amber-200","amber-900"],["green-100","green-900"],["sky-100","sky-900"],["blue-100","blue-900"],["neutral-200","neutral-900"],["orange-100","orange-900"],["yellow-100","yellow-900"],["violet-100","violet-900"]]) {
  console.log(`${bgk}/${fgk}`.padEnd(24), P[bgk], P[fgk], f(cr(P[fgk], P[bgk])), "| chipBg vs card:", f(cr(P[bgk], CARD)));
}
console.log("--- theme tokens ---");
const T = { background: BG, foreground: "#fefeff", card: CARD, primary: "#53aecc", primaryFg: "#1a1a1a", muted: "#242424", mutedFg: "#a0a0a0", border: "#333333", destructive: "#f59e0b" };
console.log("foreground/card", f(cr(T.foreground, CARD)), "foreground/bg", f(cr(T.foreground, BG)));
console.log("mutedFg/card", f(cr(T.mutedFg, CARD)), "mutedFg/bg", f(cr(T.mutedFg, BG)));
console.log("primary/card", f(cr(T.primary, CARD)), "primary/bg", f(cr(T.primary, BG)));
console.log("primaryFg/primary", f(cr(T.primaryFg, T.primary)));
console.log("destructive/card", f(cr(T.destructive, CARD)), "darkText/destructive", f(cr("#1a1a1a", T.destructive)));
console.log("border/card", f(cr(T.border, CARD)), "border/bg", f(cr(T.border, BG)));
console.log("foreground/mutedFgBg", f(cr(T.foreground, T.mutedFg)));
