/**
 * The pilot bar (owner, 11 Oct 2026, second version). It is shown only once a
 * person is signed in: the dashboard layout mounts it at the top
 * (src/components/pilot/pilot-shell.tsx, SignedInPilotBanner). For the whole
 * pilot, the free window, its end date and the Cloud Plan's price in the
 * reader's currency, with a link to the landing's pricing block; a pilot
 * begun before the window was shortened reads "Free until {date}"; in the
 * last five days the stronger end wording; once read-only, that the export
 * stays open. Never for an organisation on the paid plan, never on the kit.
 * The root layout's PilotShell carries no bar, so the landing page, the
 * documentation and the sign-in screen show none. The quiet pilot sentence
 * on the sign-in screen stays.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "user-1" } } as unknown,
  redirect: vi.fn(),
  organization: { id: "org-1", name: "Org", slug: "org", plan: "PILOT" } as
    | { id: string; name: string; slug: string; plan?: string }
    | null,
  status: undefined as unknown,
  queried: [] as unknown[],
}));

// The bar reads the selected organisation and the Settings card's status.
vi.mock("@/lib/organization-context", () => ({
  useSelectedOrganizationOrNull: () => mocks.organization,
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    organization: {
      getPilotStatus: {
        useQuery: (input: unknown, opts: { enabled?: boolean }) => {
          if (opts?.enabled) mocks.queried.push(input);
          return { data: opts?.enabled ? mocks.status : undefined };
        },
      },
    },
  },
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => mocks.session) }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useSearchParams: () => new URLSearchParams(),
}));
// The signed-in layout reads the left-menu cookie and the request path
// (src/lib/menu-cookie.ts, the safe return on session end). Neither is under
// test here; a request scope is not set up, so stub both.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => ({ get: () => null })),
}));
// The shell itself (navigation, organisation hooks) is not under test here.
vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) =>
    createElement("main", null, children),
}));

import { PilotShell } from "@/components/pilot/pilot-shell";
import { PILOT_END_BAR_DAYS, pilotEndBarState } from "@/lib/pilot-end-bar";
import DashboardLayout from "@/app/(dashboard)/layout";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

function render(locale: "en" | "es", node: ReactElement) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        timeZone: "UTC",
        messages: locale === "en" ? en : es,
      } as unknown as ComponentProps<typeof NextIntlClientProvider>,
      createElement(PilotShell, {} as ComponentProps<typeof PilotShell>, node)
    )
  );
}

async function renderSignedIn(locale: "en" | "es") {
  const layout = await DashboardLayout({ children: "page" });
  return render(locale, layout);
}

const hosted = () => vi.stubEnv("VERCEL_ENV", "production");

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);
const pilotStatus = (endsAt: Date | null, readOnly = false, transition = false) => ({
  hosted: true as const,
  paid: false as const,
  endsAt,
  readOnly,
  transition,
});

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.session = { user: { id: "user-1" } };
  mocks.organization = { id: "org-1", name: "Org", slug: "org", plan: "PILOT" };
  mocks.status = undefined;
  mocks.queried = [];
});

describe("when the bar shows", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * DAY);

  it("shows the trial for the whole pilot, the end wording in the last five days, read-only after", () => {
    expect(PILOT_END_BAR_DAYS).toBe(5);
    expect(pilotEndBarState(pilotStatus(at(15)), now)).toBe("trial");
    expect(pilotEndBarState(pilotStatus(at(14)), now)).toBe("trial");
    expect(pilotEndBarState(pilotStatus(at(5.01)), now)).toBe("trial");
    expect(pilotEndBarState(pilotStatus(at(5)), now)).toBe("ending");
    expect(pilotEndBarState(pilotStatus(at(0.1)), now)).toBe("ending");
    expect(pilotEndBarState(pilotStatus(at(-1), true), now)).toBe("readOnly");
    // The end has passed even if the status was fetched just before.
    expect(pilotEndBarState(pilotStatus(at(-0.01)), now)).toBe("readOnly");
  });

  it("is hidden before the clock starts, on the paid plan, on the kit and while loading", () => {
    expect(pilotEndBarState(pilotStatus(null), now)).toBe("hidden");
    expect(pilotEndBarState({ hosted: true, paid: true }, now)).toBe("hidden");
    expect(pilotEndBarState({ hosted: false }, now)).toBe("hidden");
    expect(pilotEndBarState(undefined, now)).toBe("hidden");
  });
});

describe("the bar on signed-in pages", () => {
  it("shows the free window, its end date and the Cloud Plan's price for the whole pilot, in English (dollars)", async () => {
    hosted();
    vi.useFakeTimers({ now: new Date("2026-10-13T09:00:00Z"), toFake: ["Date"] });
    try {
      mocks.status = pilotStatus(new Date("2026-10-28T09:00:00Z"));
      const html = await renderSignedIn("en");
      expect(html).toContain('data-state="trial"');
      expect(html).toContain(
        "Free for 15 days, until 28 October 2026. Then export your program or keep going on the Cloud Plan: $179 a month or $1,800 a year."
      );
      expect(html).toContain('href="/?lang=en#pricing"');
      expect(html).toContain(">See pricing</a>");
      expect(html).toContain('data-testid="pilot-end-bar-dismiss"');
      expect(html.indexOf("pilot-end-bar")).toBeLessThan(html.indexOf("<main>"));
      expect(html).not.toMatch(/€|\bEUR\b|\bEU\b|[\u2013\u2014]/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the free window and the Plan nube UE's price for the whole pilot, in Castilian (euros)", async () => {
    hosted();
    vi.useFakeTimers({ now: new Date("2026-10-13T09:00:00Z"), toFake: ["Date"] });
    try {
      mocks.status = pilotStatus(new Date("2026-10-28T09:00:00Z"));
      const html = await renderSignedIn("es");
      expect(html).toContain(
        "Gratis durante 15 días, hasta el 28 de octubre de 2026. Después, exporta tu programa o sigue con el Plan nube UE: 179 € al mes o 1.800 € al año."
      );
      expect(html).toContain('href="/?lang=es#precios"');
      expect(html).toContain(">Ver precios</a>");
      expect(html).not.toMatch(/\$|\bUSD\b|\busted\b|[\u2013\u2014]/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tells a pilot begun before the shorter window its real end date, without '15 days', in both languages", async () => {
    hosted();
    vi.useFakeTimers({ now: new Date("2026-10-13T09:00:00Z"), toFake: ["Date"] });
    try {
      mocks.status = pilotStatus(new Date("2026-10-27T00:00:00Z"), false, true);
      const en = await renderSignedIn("en");
      expect(en).toContain(
        "Free until 27 October 2026. Then export your program or keep going on the Cloud Plan: $179 a month or $1,800 a year."
      );
      expect(en).not.toContain("15 days");
      const es = await renderSignedIn("es");
      expect(es).toContain(
        "Gratis hasta el 27 de octubre de 2026. Después, exporta tu programa o sigue con el Plan nube UE: 179 € al mes o 1.800 € al año."
      );
      expect(es).not.toContain("15 días");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never says the dollar and euro prices are the same", () => {
    const all = JSON.stringify(en.pilot.endBar) + JSON.stringify(es.pilot.endBar);
    expect(all).not.toMatch(/same price|mismo precio|equivalent|equivalente|\$[^"]*€|€[^"]*\$/i);
  });

  it("shows nothing before the clock starts", async () => {
    hosted();
    mocks.status = pilotStatus(null);
    expect(await renderSignedIn("en")).toBe("<main>page</main>");
  });

  it("gives the end date and the pricing link in the last five days, in English", async () => {
    hosted();
    const endsAt = new Date("2026-10-26T09:00:00Z");
    vi.useFakeTimers({ now: new Date("2026-10-23T09:00:00Z"), toFake: ["Date"] });
    try {
      mocks.status = pilotStatus(endsAt);
      const html = await renderSignedIn("en");
      expect(html).toContain('data-testid="pilot-end-bar"');
      expect(html).toContain('data-state="ending"');
      expect(html).toContain(
        "Your pilot ends on 26 October 2026. Move to the paid plan to keep editing with all your records."
      );
      expect(html).toContain('href="/?lang=en#pricing"');
      expect(html).toContain(">See pricing</a>");
      // The stronger bar cannot be closed.
      expect(html).not.toContain("pilot-end-bar-dismiss");
      // At the top of the signed-in page, before the application itself.
      expect(html.indexOf("pilot-end-bar")).toBeLessThan(html.indexOf("<main>"));
      expect(html).not.toMatch(/Hosted pilot|For real data|managed instance|Run your own instance/);
      expect(html).not.toMatch(/[\u2013\u2014]/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives the end date and the Spanish prices link in the last five days, in Castilian", async () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".todo.law");
    vi.useFakeTimers({ now: new Date("2026-10-23T09:00:00Z"), toFake: ["Date"] });
    try {
      mocks.status = pilotStatus(new Date("2026-10-26T09:00:00Z"));
      const html = await renderSignedIn("es");
      expect(html).toContain(
        "Tu piloto termina el 26 de octubre de 2026. Pasa al plan de pago para seguir editando con todos tus registros."
      );
      expect(html).toContain('href="/?lang=es#precios"');
      expect(html).toContain(">Ver precios</a>");
      expect(html).not.toMatch(/Piloto alojado|datos reales|instancia gestionada|\busted\b/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says the organisation is read-only and exportable once the pilot is over, in both languages", async () => {
    hosted();
    mocks.status = pilotStatus(inDays(-3), true);
    const en = await renderSignedIn("en");
    expect(en).toContain('data-state="readOnly"');
    expect(en).toContain(
      "Your pilot has ended: the organization is read-only and you can export it at any time."
    );
    expect(en).toContain('href="/?lang=en#pricing"');
    expect(en).toContain(">See pricing</a>");
    const es = await renderSignedIn("es");
    expect(es).toContain(
      "Tu piloto ha terminado: la organización está en solo lectura y puedes exportarla cuando quieras."
    );
    expect(es).toContain('href="/?lang=es#precios"');
    expect(es).toContain(">Ver precios</a>");
  });

  it("never shows to an organisation on the paid plan, and does not even ask for its status", async () => {
    hosted();
    mocks.organization = { id: "org-1", name: "Org", slug: "org", plan: "EU_CLOUD" };
    mocks.status = pilotStatus(inDays(-3), true);
    for (const locale of ["en", "es"] as const) {
      expect(await renderSignedIn(locale)).toBe("<main>page</main>");
    }
    expect(mocks.queried).toEqual([]);
    // The status itself says paid when the selected record lags behind.
    mocks.organization = { id: "org-1", name: "Org", slug: "org", plan: "PILOT" };
    mocks.status = { hosted: true, paid: true, plan: "EU_CLOUD", renewsAt: null };
    expect(await renderSignedIn("en")).toBe("<main>page</main>");
  });

  it("is absent on the kit, signed in or not", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    mocks.status = pilotStatus(inDays(1));
    expect(await renderSignedIn("en")).toBe("<main>page</main>");
  });
});

describe("the bar on public pages", () => {
  it("the root layout carries no banner and reserves no space, in both languages", () => {
    hosted();
    for (const locale of ["en", "es"] as const) {
      const html = render(locale, createElement("main", null, "page"));
      expect(html).toBe("<main>page</main>");
    }
  });

  it("is absent from the sign-in screen, which shows the editing terms and no longer the old pilot sentence", () => {
    hosted();
    for (const locale of ["en", "es"] as const) {
      const html = render(
        locale,
        createElement(SignInForm, { methods: { local: false, email: true, google: true } }),
      );
      expect(html).not.toContain("pilot-end-bar");
      expect(html).not.toContain("hosted-pilot-sentence");
      expect(html).toContain('data-testid="hosted-pilot-terms"');
      expect(html).not.toMatch(/For real data|Para datos reales|managed instance|instancia gestionada/);
    }
  });

  it("is mounted by the dashboard layout alone, never by the landing page, docs or sign-in", () => {
    const root = path.resolve(__dirname, "../src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|jsx?)$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const mounting = files
      .filter((f) => !f.includes(`${path.sep}components${path.sep}pilot${path.sep}`))
      .filter((f) => /HostedPilotEndBar|SignedInPilotBanner/.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(root, f));
    expect(mounting).toEqual([path.join("app", "(dashboard)", "layout.tsx")]);

    // The landing page, a docs page and the sign-in screen sit outside that layout.
    for (const page of [
      "app/page.tsx",
      "app/(public)/docs/page.tsx",
      "app/(auth)/sign-in/page.tsx",
    ]) {
      expect(files).toContain(path.join(root, page));
      expect(page.startsWith("app/(dashboard)/")).toBe(false);
    }
  });

  it("the signed-in layout still sends a visitor with no session to sign in", async () => {
    mocks.session = null;
    await DashboardLayout({ children: "page" });
    // The session ends after 12 hours; the visitor is sent to sign-in with a
    // safe return path back to the page they were on.
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringMatching(/^\/sign-in\?/),
    );
  });
});

describe("hosted pilot messages", () => {
  it("states only the editing terms on the sign-in screen, in both languages (owner, 11 Oct 2026)", () => {
    expect(en.pilot.signIn).toBe(
      "Free pilot: {days} days of editing from your first sign-in, then read-only with export."
    );
    expect(es.pilot.signIn).toBe(
      "Piloto gratuito: {days} días de edición desde tu primer inicio de sesión; después, solo lectura con exportación."
    );
    expect((en.pilot as Record<string, unknown>).banner).toBeUndefined();
  });

  it("states the editing window in Settings, in both languages", () => {
    expect(en.pilot.settings.description).toContain(
      "{days} days of editing from your first sign-in, then read-only with export."
    );
    expect(es.pilot.settings.description).toContain(
      "{days} días de edición desde tu primer inicio de sesión; después, solo lectura con exportación."
    );
  });

  it("keeps the pilot messages in both languages with the same keys", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]
      );
    expect(keys(es.pilot).sort()).toEqual(keys(en.pilot).sort());
  });
});
