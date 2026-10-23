// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The experts directory has no entries, so everything that leads to it stays
 * hidden: the "Need help with ...?" boxes, the deployment box, the Help line,
 * the menu link and the page itself, all behind expertDirectoryEnabled.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { features } from "@/config/features";
import { DPO_CENTRAL_PATH } from "@/components/guided/path-config";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("the experts directory is off", () => {
  it("is off by default", () => {
    expect(features.expertDirectoryEnabled).toBe(false);
  });

  it("gates every way to it on the one flag", () => {
    for (const file of [
      "src/components/privacy/expert-help-cta.tsx",
      "src/components/privacy/deployment-expert-cta.tsx",
      "src/components/help/page-help-button.tsx",
      "src/app/(dashboard)/privacy/experts/page.tsx",
      "src/app/(dashboard)/privacy/docs/experts/page.tsx",
      "src/components/docs/toc-sidebar.tsx",
      "src/app/(dashboard)/privacy/docs/reports/page.tsx",
    ]) {
      expect(read(file), file).toContain("features.expertDirectoryEnabled");
    }
  });

  it("leaves the link out of Library and tools", () => {
    const ids = DPO_CENTRAL_PATH.library({ stripeEnabled: true }).map((i) => i.id);
    expect(ids).not.toContain("experts");
  });
});
