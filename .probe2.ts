import { blend, ratio, rgbToHex } from "./src/lib/contrast";
const CARD = "#242424";
const BG = "#1a1a1a";
const P = "#53aecc";
for (const a of [0.1, 0.15, 0.2, 0.25, 0.3]) {
  for (const [n, s] of [["card", CARD], ["bg", BG]] as const) {
    const t = rgbToHex(blend(P, s, a));
    console.log(`primary/${a * 100} over ${n} -> ${t}  text-primary ${ratio(P, t)}  foreground ${ratio("#fefeff", t)}`);
  }
}
console.log("accent/80 on card", ratio(rgbToHex(blend("#53aecc", CARD, 0.8)), CARD));
console.log("white on green-600", ratio("#ffffff", "#00a63e"));
console.log("dark on green-600", ratio("#1a1a1a", "#00a63e"));
console.log("foreground on muted-foreground", ratio("#fefeff", "#a0a0a0"));
console.log("background on muted-foreground", ratio("#1a1a1a", "#a0a0a0"));
console.log("slate-400 on card", ratio("#90a1b9", CARD));
console.log("amber-400 on card", ratio("#ffb900", CARD));
console.log("muted-foreground/70 on card", ratio(rgbToHex(blend("#a0a0a0", CARD, 0.7)), CARD));
