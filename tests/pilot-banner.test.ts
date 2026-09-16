/**
 * Hosted pilot banner (src/components/pilot/pilot-shell.tsx, mounted in the
 * root layout, so it is on every page). Present on the hosted service, in
 * English and Castilian Spanish, with the link to /run; absent on the kit.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import { PilotShell } from "@/components/pilot/pilot-shell";

function renderPage(locale: "en" | "es") {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      {
        locale,
        timeZone: "UTC",
        messages: locale === "en" ? en : es,
      } as unknown as ComponentProps<typeof NextIntlClientProvider>,
      createElement(
        PilotShell,
        {} as ComponentProps<typeof PilotShell>,
        createElement("main", null, "page")
      )
    )
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("hosted pilot banner", () => {
  it("is present on the hosted service, in English, with the /run link", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = renderPage("en");
    expect(html).toContain('data-testid="hosted-pilot-banner"');
    expect(html).toContain(
      "Hosted pilot: free, capped, no security certification. For real client data, "
    );
    expect(html).toContain('href="https://www.todo.law/run"');
    expect(html).toContain("run your own instance</a>.");
    expect(html).toContain("<main>page</main>");
  });

  it("is present in Castilian Spanish", () => {
    vi.stubEnv("AUTH_COOKIE_DOMAIN", ".todo.law");
    const html = renderPage("es");
    expect(html).toContain('data-testid="hosted-pilot-banner"');
    expect(html).toContain(
      "Piloto alojado: gratuito, con límites y sin certificación de seguridad. Para datos reales de clientes, "
    );
    expect(html).toContain("ejecuta tu propia instancia</a>.");
    expect(html).toContain('aria-label="Cerrar"');
  });

  it("is absent on the kit", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("AUTH_COOKIE_DOMAIN", "");
    const html = renderPage("en");
    expect(html).not.toContain("hosted-pilot");
    expect(html).not.toContain("Hosted pilot");
    expect(html).toBe("<main>page</main>");
  });

  it("keeps the pilot messages in both languages with the same keys", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`]
      );
    expect(keys(es.pilot).sort()).toEqual(keys(en.pilot).sort());
  });
});
