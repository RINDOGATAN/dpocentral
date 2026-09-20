/**
 * The signed-in screens must not scroll sideways at 390px.
 *
 * This is a source scan, not a rendered measurement: the repository has no
 * browser test setup, and adding one (Playwright plus its browser binaries,
 * a running server and a signed-in session) is more than a layout fix should
 * install. See "Needs the owner" in STATUS.md. What a scan can do is refuse
 * the class patterns that caused the problem, each with a named exception and
 * a reason, so a new page cannot reintroduce them quietly.
 *
 * The rule the scan enforces: at phone width the page body never grows wider
 * than the viewport. A table, a wide diagram or a tab strip may scroll inside
 * its own container; everything else stacks, wraps or shrinks.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOTS = [
  "src/app/(dashboard)",
  "src/app/(admin)",
  "src/components",
] as const;

/** The narrow phone the rule is written for. */
const PHONE_WIDTH = 390;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const FILES = ROOTS.flatMap((root) => walk(root));

/** className="..." , className={`...`} and className={cn(...)}. */
const CLASS_ATTR =
  /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(([\s\S]*?)\)\})/g;

type ClassUse = { file: string; line: number; source: string; tokens: string[] };

function classUses(file: string): ClassUse[] {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  const uses: ClassUse[] = [];
  for (const match of src.matchAll(CLASS_ATTR)) {
    // Drop ${...} interpolations: their contents are conditional classes we
    // read separately, and they would otherwise split into stray tokens.
    const raw = (match[1] ?? match[2] ?? match[3] ?? "").replace(
      /\$\{[^}]*\}/g,
      " "
    );
    const line = src.slice(0, match.index).split("\n").length;
    uses.push({
      file,
      line,
      source: lines[line - 1].trim(),
      tokens: raw.split(/[\s"'`,]+/).filter(Boolean),
    });
  }
  return uses;
}

const ALL_USES = FILES.flatMap(classUses);

const at = (u: ClassUse) => `${u.file}:${u.line}  ${u.source.slice(0, 96)}`;

describe("no sideways scrolling at phone width, signed in", () => {
  it("has signed-in sources to scan", () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(ALL_USES.length).toBeGreaterThan(1000);
  });

  /**
   * A control pinned to a pixel width cannot give way to the field or the
   * button beside it. Allowed only where the element is not laid out in the
   * page flow, or is narrow enough to leave room at 390px on purpose.
   */
  it("pins no control to a pixel width without a phone form", () => {
    const allowed: Record<string, string> = {
      "src/components/dashboard-shell.tsx w-[280px]":
        "the navigation drawer: fixed position, off canvas, narrower than the phone",
      "src/app/(dashboard)/privacy/docs/layout.tsx w-[280px]":
        "the user guide drawer: fixed position, off canvas, narrower than the phone",
      "src/app/(dashboard)/privacy/page.tsx w-[240px]":
        "the organisation menu: a portalled popover, positioned away from the edges by Radix",
      "src/app/(dashboard)/privacy/dsar/[id]/page.tsx w-[120px]":
        "a compact task status select; 120px leaves the task name room at 390px",
      "src/app/(dashboard)/privacy/experts/page.tsx w-[160px]":
        "sits in a flex-wrap row beside a min-w-0 block, so it wraps before it pushes",
      "src/components/privacy/data-flow/AssetNode.tsx w-[220px]":
        "a node drawn on the flow canvas, which pans and zooms on its own",
    };

    const offenders: string[] = [];
    for (const use of ALL_USES) {
      if (use.tokens.includes("w-full")) continue;
      for (const token of use.tokens) {
        if (!/^w-\[\d+px\]$/.test(token)) continue;
        const key = `${use.file} ${token}`;
        if (key in allowed) continue;
        offenders.push(`${at(use)}   [${token}]`);
      }
    }
    expect(offenders, "use w-full sm:w-[...], or add a reason to the allowlist")
      .toEqual([]);
  });

  /** A minimum wider than the phone has to live inside something that scrolls. */
  it("keeps every wide minimum inside a container that scrolls", () => {
    const offenders: string[] = [];
    for (const use of ALL_USES) {
      for (const token of use.tokens) {
        const m = /^min-w-\[(\d+)px\]$/.exec(token);
        if (!m || Number(m[1]) <= PHONE_WIDTH) continue;
        const scrolls = readFileSync(use.file, "utf8").includes("overflow-x-auto")
          || readFileSync(use.file, "utf8").includes("overflow-auto");
        if (scrolls) continue;
        offenders.push(`${at(use)}   [${token}]`);
      }
    }
    expect(offenders, "keep the minimum, wrap it in overflow-x-auto").toEqual([]);
  });

  /** Counter and statistic cards: one or two columns on a phone, never more. */
  it("gives no grid three or more columns before a breakpoint", () => {
    const offenders: string[] = [];
    for (const use of ALL_USES) {
      for (const token of use.tokens) {
        if (/^grid-cols-([3-9]|1[0-2])$/.test(token)) {
          offenders.push(`${at(use)}   [${token}]`);
        }
      }
    }
    expect(offenders, "prefix it: grid-cols-2 sm:grid-cols-4").toEqual([]);
  });

  /**
   * A centred flex row that cannot wrap is the worst case: the overflow goes
   * off both edges, so the left of the page cannot be reached by scrolling.
   */
  it("lets every centred row of content wrap", () => {
    const allowed: Record<string, string> = {
      "src/components/privacy/onboarding-welcome.tsx":
        "the logo beside the brand name, under 200px in both languages",
      "src/components/privacy/organization-setup.tsx":
        "the logo beside the brand name, under 200px in both languages",
      "src/components/privacy/persona-selector.tsx":
        "the logo beside the brand name, under 200px in both languages",
    };

    const offenders: string[] = [];
    for (const use of ALL_USES) {
      const t = use.tokens;
      if (!t.includes("flex") || t.includes("flex-col")) continue;
      if (!t.includes("justify-center")) continue;
      if (t.includes("flex-wrap") || t.some((x) => x.endsWith(":flex-wrap"))) continue;
      if (t.some((x) => /^(sm|md|lg|xl):flex-col$/.test(x))) continue;
      if (t.includes("overflow-x-auto") || t.includes("overflow-auto")) continue;
      // An icon or avatar box centres a single glyph inside its own fixed
      // size. It holds no content that can grow, so it never widens a page.
      if (t.some((x) => /^(w-\d|h-\d|size-\d|w-\[|min-h-\[)/.test(x))) continue;
      // Without a gap there is nothing side by side to overflow.
      if (!t.some((x) => /^gap-/.test(x))) continue;
      if (use.file in allowed) continue;
      offenders.push(at(use));
    }
    expect(offenders, "add flex-wrap, or scroll the row in its own container")
      .toEqual([]);
  });

  /**
   * A page heading and its actions on one unstackable line is what pushed the
   * signed-in pages past the edge. Castilian titles are longer than the
   * English ones, so the row has to be able to stack rather than to fit.
   */
  it("stacks every page heading above its actions", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!/<h1[\s>]/.test(line)) return;
        // The row that holds the heading is a few lines above it.
        for (let j = Math.max(0, i - 10); j < i; j++) {
          const above = lines[j];
          if (!/className=/.test(above) || !/justify-between/.test(above)) continue;
          if (/flex-col/.test(above)) return;
          offenders.push(`${file}:${j + 1}  ${above.trim().slice(0, 96)}`);
          return;
        }
      });
    }
    expect(
      offenders,
      "use flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    ).toEqual([]);
  });

  /**
   * A search field beside a filter or a primary button. On a phone that row
   * has to give way: it stacks, or it wraps. A row that can do neither pushes
   * a list page past the edge before a single result is drawn. A row holding
   * the field and nothing else has nothing to overflow against, so it passes.
   */
  it("lets every row that holds a search field give way", () => {
    const indent = (l: string) => l.length - l.trimStart().length;

    const offenders: string[] = [];
    for (const file of FILES) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // The wrapper the tree uses for a search field: the icon is absolute
        // inside it, so the field is the part of the row that can shrink.
        if (!/className="relative flex-1/.test(line)) return;

        // The row is the nearest flex container opened above the field.
        let row = -1;
        for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
          if (/className=/.test(lines[j]) && /\bflex\b/.test(lines[j])) {
            row = j;
            break;
          }
        }
        if (row < 0) return;
        if (/flex-col|flex-wrap/.test(lines[row])) return;

        // Count what else the row holds: children one level in, up to the
        // line that closes the row at the row's own indentation.
        const rowIndent = indent(lines[row]);
        let children = 0;
        for (let j = row + 1; j < lines.length; j++) {
          const text = lines[j].trim();
          if (!text) continue;
          if (indent(lines[j]) <= rowIndent && text.startsWith("</")) break;
          if (indent(lines[j]) === rowIndent + 2 && /^<[A-Za-z]/.test(text)) children++;
        }
        if (children < 2) return;

        offenders.push(`${file}:${row + 1}  ${lines[row].trim().slice(0, 96)}`);
      });
    }
    expect(
      offenders,
      "use flex flex-col sm:flex-row gap-3, or flex flex-wrap gap-3"
    ).toEqual([]);
  });

  /**
   * An e-mail address and a generated identifier are single unbroken tokens,
   * routinely wider than the phone on their own. Printed in a flex child they
   * set the width of the row and the row sets the width of the page, so each
   * one has to break, clamp, or be cut short with the value reachable
   * elsewhere.
   */
  it("breaks every address and identifier it prints", () => {
    const GIVES_WAY = /break-all|break-words|truncate|line-clamp/;

    const allowed: Record<string, string> = {
      "src/app/(admin)/admin/customers/[id]/page.tsx":
        "the licence key is printed elided to eleven characters, first four and last four",
    };

    /**
     * Whether a line sits inside an element of the given kind: walk back to
     * the nearest opening or closing tag of that kind and see which it was.
     */
    function inside(lines: string[], i: number, open: RegExp): boolean {
      const close = new RegExp(open.source.replace("<", "</").replace("[\\s>]", ">"));
      for (let j = i; j >= 0; j--) {
        if (close.test(lines[j]) && j !== i) return false;
        if (open.test(lines[j])) return true;
      }
      return false;
    }

    const insideTableCell = (lines: string[], i: number) =>
      inside(lines, i, /<TableCell[\s>]/) || inside(lines, i, /<TableHead[\s>]/);

    /** The className governing a line: its own, or the tag opened above it. */
    function governing(lines: string[], i: number): string {
      for (let j = i; j >= Math.max(0, i - 3); j--) {
        // A sibling that opens and closes on its own line, an icon say, is
        // not the element the value sits in.
        if (j < i && /\/>\s*$/.test(lines[j])) continue;
        const m = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(lines[j]);
        if (m) return m[1] ?? m[2] ?? "";
        // A tag that closes above this line governs nothing here.
        if (j < i && /<\/[a-zA-Z]/.test(lines[j])) break;
      }
      return "";
    }

    const offenders: string[] = [];
    for (const file of FILES) {
      if (file in allowed) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        // An address read off a record and printed as the content of an
        // element: {user.email}, {request.requesterEmail}, or a name with an
        // address behind it. Not a translated label, which is a call; not
        // emailVerified, which is a date; not an attribute value.
        const expression = /(?:^|>)\s*\{([^{}()]*)\}/.exec(line)?.[1] ?? "";
        const printsAddress = /\.\w*[eE]mail\b/.test(expression);

        // An identifier in a <code> element, where the content is a value and
        // not a literal such as the name of a variable or a fixed path.
        const closed = /<code[^>]*>([^<]*)</.exec(line);
        const printsIdentifier = /<code[\s>]/.test(line)
          ? closed
            ? closed[1].includes("{")
            : (lines[i + 1] ?? "").trim().startsWith("{")
          : false;

        if (!printsAddress && !printsIdentifier) return;
        // A table keeps its own minimum and scrolls inside its wrapper, which
        // the check above asserts, so a cell may hold an unbroken token.
        if (insideTableCell(lines, i)) return;
        // A menu or select item is drawn in a portal, positioned by Radix and
        // kept off the edges by it. It is not in the page flow.
        if (inside(lines, i, /<(SelectItem|DropdownMenuItem|CommandItem)[\s>]/)) return;
        if (GIVES_WAY.test(governing(lines, i))) return;
        offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 96)}`);
      });
    }
    expect(
      offenders,
      "add break-all (or truncate, where the whole value is reachable elsewhere)"
    ).toEqual([]);
  });

  /** A tab strip scrolls inside its own bar rather than widening the page. */
  it("makes the tab strip scroll inside itself", () => {
    const tabs = readFileSync("src/components/ui/tabs.tsx", "utf8");
    const list = tabs.slice(tabs.indexOf("const TabsList"), tabs.indexOf("const TabsTrigger"));
    expect(list).toContain("max-w-full");
    expect(list).toContain("overflow-x-auto");
    // A centred overflowing flex container puts its own start out of reach.
    expect(list).not.toContain("justify-center");
    // Triggers must keep their text on one line, so the strip scrolls rather
    // than squeezing them below their own content.
    const trigger = tabs.slice(tabs.indexOf("const TabsTrigger"));
    expect(trigger).toContain("whitespace-nowrap");
  });

  /** A table keeps its minimum and scrolls in its own wrapper. */
  it("wraps every table in a container that scrolls", () => {
    const table = readFileSync("src/components/ui/table.tsx", "utf8");
    const wrapper = table.slice(table.indexOf("function Table("), table.indexOf("function TableHeader"));
    expect(wrapper).toContain("overflow-auto");
  });

  /** The link row in the signed-in footer is on every page behind the login. */
  it("wraps the footer links of the signed-in shell", () => {
    const shell = readFileSync("src/components/dashboard-shell.tsx", "utf8");
    const footer = shell.slice(shell.indexOf("<footer"));
    const row = footer.split("\n").find((l) => l.includes("justify-center"));
    expect(row).toBeDefined();
    expect(row).toContain("flex-wrap");
  });

  /** The hosted pilot banner wraps its sentence and keeps its dismiss control. */
  it("keeps the pilot banner inside the viewport", () => {
    const banner = readFileSync("src/components/pilot/hosted-pilot.tsx", "utf8");
    // Fixed to the viewport edges, so it is sized by the screen, not by text.
    expect(banner).toContain("fixed bottom-0 inset-x-0");
    // The sentence clamps by line rather than running off the side.
    expect(banner).toMatch(/line-clamp-\d/);
    // The dismiss control keeps its size whatever the sentence does.
    expect(banner).toContain("shrink-0");
  });
});
