import { readFileSync } from "fs";
import path from "path";
import {
  ROOT,
  classNameStrings,
  pairsInString,
  sweepFiles,
  tintedTextInString,
} from "./tests/helpers/class-colours";

let n = 0;
for (const file of sweepFiles()) {
  const rel = path.relative(ROOT, file);
  const src = readFileSync(file, "utf8");
  const lines: string[] = [];
  for (const value of classNameStrings(src)) {
    const { pairs, unknown } = pairsInString(value);
    for (const u of unknown) lines.push(`  UNKNOWN ${u}`);
    for (const p of pairs) {
      if (p.measured < p.threshold) {
        lines.push(`  ${p.kind === "mark" ? "MARK" : "LOW "} ${p.klass} on ${p.bgLabel} = ${p.measured} (need ${p.threshold})`);
      }
    }
    for (const t of tintedTextInString(value)) lines.push(`  HUE  ${t}   [${value.trim().slice(0, 90)}]`);
  }
  const uniq = [...new Set(lines)];
  if (uniq.length) {
    n += uniq.length;
    console.log(rel);
    console.log(uniq.join("\n"));
  }
}
console.log(`\n${n} findings`);
