// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Left menu entries must not vanish while data loads or is fetched again:
 *
 * - A step listed only for some organisations (AI systems) stays listed while
 *   the progress is held back for the member's scope (shownStatuses).
 * - A stage the menu opened by itself stays open on that page when the
 *   default moves (keptOpenStages), so its steps do not fold away when the
 *   progress arrives or a refetch answers differently.
 * - The session is not refetched on tab focus: next-auth replaces it with null
 *   when that request fails and never asks again while it is null.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { LayoutDashboard } from "lucide-react";
import { PathMenu } from "@/components/guided/path-menu";
import { DPO_CENTRAL_PATH, EMPTY_PATH_COUNTS } from "@/components/guided/path-config";
import { evaluatePath, keptOpenStages } from "@/components/guided/path";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const t = (key: string) => key;
const WITH_AI = evaluatePath(DPO_CENTRAL_PATH, { ...EMPTY_PATH_COUNTS, aiSystems: 2 });

function menu(props: { statuses: typeof WITH_AI | null; shownStatuses?: typeof WITH_AI | null; collapsed?: boolean }) {
  return renderToStaticMarkup(
    <PathMenu
      config={DPO_CENTRAL_PATH}
      pathname="/privacy"
      stripeEnabled={false}
      variant="sidebar"
      t={t}
      overview={{ href: "/privacy", icon: LayoutDashboard }}
      {...props}
    />,
  );
}

describe("a step listed only for some organisations", () => {
  it("is listed while the progress is held back, when the statuses are known", () => {
    expect(menu({ statuses: null, shownStatuses: WITH_AI })).toContain("steps.aiSystems.label");
  });

  it("is not listed before anything is known", () => {
    expect(menu({ statuses: null })).not.toContain("steps.aiSystems.label");
  });

  it("does not show the held-back progress", () => {
    const html = menu({ statuses: null, shownStatuses: WITH_AI });
    expect(html).not.toContain('data-testid="stage-word-');
  });

  it("the guided layout passes the statuses for listing even while the scope loads", () => {
    const src = read("src/components/guided/guided-layout.tsx");
    expect(src).toMatch(/statuses: limited === null \? null : statuses,/);
    expect(src).toMatch(/shownStatuses: statuses,/);
  });
});

describe("keptOpenStages: a stage opened by itself stays open on the page", () => {
  it("starts from the default on a page", () => {
    expect(keptOpenStages(null, "/privacy", "setup")).toEqual({ pathname: "/privacy", ids: ["setup"] });
    expect(keptOpenStages(null, "/privacy/settings", null)).toEqual({ pathname: "/privacy/settings", ids: [] });
  });

  it("keeps the loading default open when the progress names another stage", () => {
    const loading = keptOpenStages(null, "/privacy", "setup");
    const loaded = keptOpenStages(loading, "/privacy", "inventory");
    expect(loaded.ids).toEqual(["setup", "inventory"]);
    // A later refetch moving the next step again closes neither.
    expect(keptOpenStages(loaded, "/privacy", "assess").ids).toEqual(["setup", "inventory", "assess"]);
  });

  it("returns the same object once settled, so the menu does not re-render in a loop", () => {
    const settled = keptOpenStages(null, "/privacy", "setup");
    expect(keptOpenStages(settled, "/privacy", "setup")).toBe(settled);
    expect(keptOpenStages(settled, "/privacy", null)).toBe(settled);
  });

  it("starts again from the new page's default after a change of page", () => {
    const before = keptOpenStages(keptOpenStages(null, "/privacy", "setup"), "/privacy", "inventory");
    expect(keptOpenStages(before, "/privacy/incidents", "respond")).toEqual({
      pathname: "/privacy/incidents",
      ids: ["respond"],
    });
  });
});

describe("the session survives a failed refetch on tab focus", () => {
  it("SessionProvider does not refetch on window focus", () => {
    expect(read("src/components/providers.tsx")).toMatch(/<SessionProvider session=\{session\} refetchOnWindowFocus=\{false\}>/);
  });
});
