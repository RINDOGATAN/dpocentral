// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Inside the product, every price hint shows the currency the customer will
 * actually be charged: euros only in the 27 EU member states, US dollars
 * everywhere else, whatever the interface language. The pilot bar's hint and
 * its "Move to the paid plan" button come from one decision
 * (inAppPlanOffer, src/lib/plan-upgrade.ts), so they always agree. The
 * public Spanish pages keep their own rule (always euros) and are covered in
 * region-currency.test.tsx.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const EUR_LINK = "https://pay.example.test/eur";
const USD_LINK = "https://pay.example.test/usd";

const mocks = vi.hoisted(() => ({
  country: null as string | null,
  acceptLanguage: null as string | null,
}));

vi.mock("@/lib/organization-context", () => ({
  useSelectedOrganizationOrNull: () => ({ id: "org1", name: "Org", slug: "org", plan: "PILOT", role: "OWNER" }),
}));
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
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => requestHeaders()),
}));
vi.mock("@/components/dashboard-shell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => createElement("main", null, children),
}));
vi.mock("@/lib/session-cookie", () => ({
  getSessionToken: vi.fn(async () => ({ email: "owner@example.test" })),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    organizationMember: {
      findFirst: vi.fn(async () => ({ role: "OWNER", organization: { plan: "PILOT" } })),
    },
  },
}));

import DashboardLayout from "@/app/(dashboard)/layout";
import { GET as planCheckout } from "@/app/api/plan/checkout/route";
import { PilotShell } from "@/components/pilot/pilot-shell";
import { useFormatPrice, usePriceInSentence } from "@/components/region-provider";
import { inAppPlanOffer } from "@/lib/plan-upgrade";
import { pilotEndBarPrice } from "@/lib/pilot-end-bar";

function requestHeaders(): Headers {
  const h = new Headers();
  if (mocks.country) h.set("x-vercel-ip-country", mocks.country);
  if (mocks.acceptLanguage) h.set("accept-language", mocks.acceptLanguage);
  return h;
}

/** A page inside the product that shows the add-on and premium hints. */
function InAppHints() {
  const formatPrice = useFormatPrice();
  const inSentence = usePriceInSentence();
  return createElement(
    "p",
    null,
    createElement("span", { "data-hint": "addon" }, formatPrice(9)),
    createElement("span", { "data-hint": "sentence" }, inSentence(49))
  );
}

async function renderSignedIn(locale: "en" | "es") {
  const layout = (await DashboardLayout({ children: createElement(InAppHints) })) as ReactElement;
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale, timeZone: "UTC", messages: locale === "en" ? en : es } as unknown as ComponentProps<
        typeof NextIntlClientProvider
      >,
      createElement(PilotShell, {} as ComponentProps<typeof PilotShell>, layout)
    )
  );
}

/** Where "Move to the paid plan" sends this request. */
async function buttonTarget(): Promise<string | null> {
  const res = await planCheckout(
    new Request("https://app.example.test/api/plan/checkout?org=org1", { headers: requestHeaders() })
  );
  return res.status === 303 ? res.headers.get("location") : null;
}

const hint = (html: string, name: string) => new RegExp(`data-hint="${name}">([^<]*)<`).exec(html)?.[1];

function switchOn() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("AUTO_UPGRADE_ENABLED", "true");
  vi.stubEnv("PLAN_SYNC_SECRET", "test-secret");
  vi.stubEnv("PLAN_CLOUD_EUR_LINK", EUR_LINK);
  vi.stubEnv("PLAN_CLOUD_USD_LINK", USD_LINK);
}

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.country = null;
  mocks.acceptLanguage = null;
});

const CASES = [
  {
    name: "Spanish interface outside the EU",
    locale: "es",
    country: "US",
    currency: "USD",
    bar: "179 US$ al mes o 1.800 US$ al año",
    addon: "$9",
    sentence: "49 US$",
    link: USD_LINK,
  },
  {
    name: "Spanish interface in the EU",
    locale: "es",
    country: "ES",
    currency: "EUR",
    bar: "179 € al mes o 1.800 € al año",
    addon: "€9",
    sentence: "49 €",
    link: EUR_LINK,
  },
  {
    name: "English interface in the EU",
    locale: "en",
    country: "DE",
    currency: "EUR",
    bar: "€179 a month or €1,800 a year",
    addon: "€9",
    sentence: "€49",
    link: EUR_LINK,
  },
  {
    name: "English interface in the US",
    locale: "en",
    country: "US",
    currency: "USD",
    bar: "$179 a month or $1,800 a year",
    addon: "$9",
    sentence: "$49",
    link: USD_LINK,
  },
] as const;

describe("in-app prices follow the charge currency, not the language", () => {
  it.each(CASES)("$name: hints in $currency, button to the $currency link", async (c) => {
    switchOn();
    mocks.country = c.country;
    const html = await renderSignedIn(c.locale);

    // The pilot bar's hint, the add-on price and a "{price} a month" sentence.
    expect(html).toContain(c.bar);
    expect(hint(html, "addon")).toBe(c.addon);
    expect(hint(html, "sentence")).toBe(c.sentence);
    expect(html).toContain('data-testid="pilot-upgrade-link"');

    // The button charges in the same currency.
    expect(inAppPlanOffer(requestHeaders()).currency).toBe(c.currency);
    expect(await buttonTarget()).toMatch(new RegExp(`^${c.link}\\?`));

    // And no price in the other currency anywhere on the screen.
    const other = c.currency === "USD" ? /€/ : /\$/;
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(other);
  });

  it("the hint and the button always agree, for every country and language", async () => {
    switchOn();
    const countries = [null, "US", "MX", "AR", "GB", "CH", "NO", "ES", "DE", "FR", "IE", "GR", "XX"];
    const languages = [null, "es-ES,es;q=0.9", "es-MX", "en-GB", "en-US"];
    for (const locale of ["en", "es"] as const) {
      for (const country of countries) {
        for (const acceptLanguage of languages) {
          mocks.country = country;
          mocks.acceptLanguage = acceptLanguage;
          const html = await renderSignedIn(locale);
          const target = await buttonTarget();
          const charged = target?.startsWith(EUR_LINK) ? "EUR" : target?.startsWith(USD_LINK) ? "USD" : null;
          expect(charged, `${locale} ${country} ${acceptLanguage}`).not.toBeNull();
          expect(html, `${locale} ${country} ${acceptLanguage}`).toContain(pilotEndBarPrice(locale, charged!));
        }
      }
    }
  });
});
