// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The TODO.LAW logo on the public landing leads to the main storefront
 * (https://www.todo.law, or /es when the landing shows Spanish), in the
 * header and in the footer. It carries an accessible name, and the product's
 * own name next to it keeps its own link.
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StartupsHeader from "./components/StartupsHeader";
import StartupsFooter from "./components/StartupsFooter";

const t = (k: string) => k;
const noop = () => {};

function hrefOf(html: string, testId: string): { href: string; label: string } {
  const tag = html.match(new RegExp(`<a[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? "";
  return {
    href: tag.match(/href="([^"]*)"/)?.[1] ?? "",
    label: tag.match(/aria-label="([^"]*)"/)?.[1] ?? "",
  };
}

const header = (locale: "en" | "es") =>
  renderToStaticMarkup(
    createElement(StartupsHeader, { t, locale, onLocaleToggle: noop, onSignup: noop }),
  );
const footer = (locale: "en" | "es") => renderToStaticMarkup(createElement(StartupsFooter, { t, locale }));

describe("TODO.LAW logo link on the landing", () => {
  it("header: storefront in English, storefront /es in Spanish, with an accessible name", () => {
    expect(hrefOf(header("en"), "landing-logo-link")).toEqual({ href: "https://www.todo.law", label: "TODO.LAW" });
    expect(hrefOf(header("es"), "landing-logo-link")).toEqual({
      href: "https://www.todo.law/es",
      label: "TODO.LAW: inicio",
    });
  });

  it("header: the product name keeps its own link to the landing", () => {
    const html = header("en");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>\s*<span/);
  });

  it("footer: storefront in English, storefront /es in Spanish", () => {
    expect(hrefOf(footer("en"), "footer-logo-link")).toEqual({ href: "https://www.todo.law", label: "TODO.LAW" });
    expect(hrefOf(footer("es"), "footer-logo-link")).toEqual({
      href: "https://www.todo.law/es",
      label: "TODO.LAW: inicio",
    });
  });
});
