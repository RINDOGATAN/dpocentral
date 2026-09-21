/**
 * Hosted pilot banner. It is shown only once a person is signed in: the
 * dashboard layout mounts it (src/components/pilot/pilot-shell.tsx,
 * SignedInPilotBanner). The root layout's PilotShell carries no banner, so
 * the landing page, the documentation and the sign-in screen show none and
 * reserve no space for one. The quiet pilot sentence on the sign-in screen
 * stays. Wording, dismissal and storage key are unchanged; absent on the kit.
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
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => mocks.session) }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useSearchParams: () => new URLSearchParams(),
}));
// The shell itself (navigation, organisation hooks) is not under test here.
vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) =>
    createElement("main", null, children),
}));

import { PilotShell } from "@/components/pilot/pilot-shell";
import DashboardLayout from "@/app/(dashboard)/layout";
import SignInPage from "@/app/(auth)/sign-in/page";

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

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.session = { user: { id: "user-1" } };
});

describe("hosted pilot banner: signed-in pages", () => {
  it("is present in the signed-in layout, in English, with the docs and /run links", async () => {
    hosted();
    const html = await renderSignedIn("en");
    expect(html).toContain("<main>page</main>");
    expect(html).toContain('data-testid="hosted-pilot-banner"');
    expect(html).toContain("Hosted pilot: free, capped (");
    expect(html).toContain('href="/docs#hosted-pilot"');
    expect(html).toContain("see docs</a>");
    expect(html).toContain(
      "), and with no contractual safeguards. To deploy real customer details, "
    );
    expect(html).toContain('href="https://www.todo.law/run"');
    expect(html).toContain("run your own instance</a>.");
    expect(html).toContain('aria-label="Dismiss"');
  });

  it("is present in the signed-in layout in Castilian Spanish", async () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".todo.law");
    const html = await renderSignedIn("es");
    expect(html).toContain('data-testid="hosted-pilot-banner"');
    expect(html).toContain("Piloto alojado: gratuito, limitado (");
    expect(html).toContain("ver documentación</a>");
    expect(html).toContain(
      ") y sin garantías contractuales. Para manejar datos reales de clientes, "
    );
    expect(html).toContain("usa tu propia instancia</a>.");
    expect(html).toContain('aria-label="Cerrar"');
  });

  it("is absent on the kit, signed in or not", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    expect(await renderSignedIn("en")).toBe("<main>page</main>");
  });
});

describe("hosted pilot banner: public pages", () => {
  it("the root layout carries no banner and reserves no space, in both languages", () => {
    hosted();
    for (const locale of ["en", "es"] as const) {
      const html = render(locale, createElement("main", null, "page"));
      expect(html).toBe("<main>page</main>");
    }
  });

  it("is absent from the sign-in screen, which keeps its quiet pilot sentence", () => {
    hosted();
    for (const locale of ["en", "es"] as const) {
      const html = render(locale, createElement(SignInPage));
      expect(html).not.toContain("hosted-pilot-banner");
      expect(html).not.toContain(locale === "en" ? "Hosted pilot notice" : es.pilot.bannerLabel);
      expect(html).toContain('data-testid="hosted-pilot-sentence"');
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
      .filter((f) => /HostedPilotBanner|SignedInPilotBanner/.test(readFileSync(f, "utf8")))
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
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });
});

describe("hosted pilot messages", () => {
  it("sends the reader to the documentation for the limits, in both languages", () => {
    // The sign-up screen renders HostedPilotSentence, i.e. `pilot.banner`.
    expect(en.pilot.banner).toContain("<docs>see docs</docs>");
    expect(es.pilot.banner).toContain("<docs>ver documentación</docs>");
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
