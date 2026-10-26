// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * "Move to the paid plan" in the pilot bar: shown only with the automatic
 * upgrade switched on, only to an owner or admin of the selected pilot
 * organisation, in both languages, and pointing at the checkout route.
 */

import { describe, it, expect, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const selected = vi.hoisted(() => ({
  org: null as null | { id: string; name: string; slug: string; plan?: string; role?: string },
}));
vi.mock("@/lib/organization-context", () => ({
  useSelectedOrganizationOrNull: () => selected.org,
}));
// A pilot in its free window, as the Settings card's status reports it.
vi.mock("@/lib/trpc", () => ({
  trpc: {
    organization: {
      getPilotStatus: {
        useQuery: (_input: unknown, opts: { enabled?: boolean }) => ({
          data: opts?.enabled
            ? {
                hosted: true,
                paid: false,
                endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                readOnly: false,
                transition: false,
              }
            : undefined,
        }),
      },
    },
  },
}));

import { HostedPilotEndBar } from "@/components/pilot/hosted-pilot";

function render(locale: "en" | "es", upgrade: boolean, upgradeMonthly = false) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, timeZone: "UTC", messages: locale === "en" ? en : es } as unknown as ComponentProps<
        typeof NextIntlClientProvider
      >,
      createElement(HostedPilotEndBar, { upgrade, upgradeMonthly })
    )
  );
}

const pilotOrg = (role: string, plan = "PILOT") => ({ id: "cmorg1", name: "Org", slug: "org", plan, role });

describe("pilot banner: move to the paid plan", () => {
  it("is offered to an owner and an admin when switched on, in both languages", () => {
    for (const role of ["OWNER", "ADMIN"]) {
      selected.org = pilotOrg(role);
      const html = render("en", true);
      expect(html).toContain('data-testid="pilot-upgrade-link"');
      expect(html).toContain('href="/api/plan/checkout?org=cmorg1"');
      expect(html).toContain("Move to the paid plan");
    }
    expect(render("es", true)).toContain("Pasar al plan de pago");
  });

  it("is not offered when switched off, to other roles, or without an organisation", () => {
    selected.org = pilotOrg("OWNER");
    expect(render("en", false)).not.toContain("pilot-upgrade-link");
    for (const role of ["PRIVACY_OFFICER", "MEMBER", "VIEWER"]) {
      selected.org = pilotOrg(role);
      expect(render("en", true)).not.toContain("pilot-upgrade-link");
    }
    selected.org = null;
    expect(render("en", true)).not.toContain("pilot-upgrade-link");
  });

  it("is absent with the whole bar on the paid plan", () => {
    selected.org = pilotOrg("OWNER", "EU_CLOUD");
    expect(render("en", true)).toBe("");
  });

  it("states no price", () => {
    expect(en.pilot.endBar.upgrade).not.toMatch(/\d|€|\$/);
    expect(es.pilot.endBar.upgrade).not.toMatch(/\d|€|\$/);
  });
});

describe("pilot banner: monthly and yearly", () => {
  it("offers two links, monthly then yearly, once the monthly link is set", () => {
    selected.org = pilotOrg("OWNER");
    const html = render("en", true, true);
    expect(html).toContain('href="/api/plan/checkout?org=cmorg1&amp;interval=month"');
    expect(html).toContain('data-testid="pilot-upgrade-monthly-link"');
    expect(html).toContain('href="/api/plan/checkout?org=cmorg1"');
    expect(html).toContain("Pay monthly");
    expect(html).toContain("Pay yearly");
    expect(html).not.toContain("Move to the paid plan");
    expect(html.indexOf("Pay monthly")).toBeLessThan(html.indexOf("Pay yearly"));
    const es = render("es", true, true);
    expect(es).toContain("Pago mensual");
    expect(es).toContain("Pago anual");
  });

  it("keeps the single link while monthly is not set, and shows neither to other roles", () => {
    selected.org = pilotOrg("OWNER");
    const html = render("en", true, false);
    expect(html).toContain("Move to the paid plan");
    expect(html).not.toContain("pilot-upgrade-monthly-link");
    selected.org = pilotOrg("MEMBER");
    expect(render("en", true, true)).not.toContain("pilot-upgrade");
  });
});
