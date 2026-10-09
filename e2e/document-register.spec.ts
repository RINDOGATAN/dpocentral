// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The document register and the Guided dashboard (owner's decisions d4 to d7,
 * 9 October 2026), seen in a browser at three moments of one organisation:
 * empty, after the quick start, and after confirming the drafts and filling
 * records (a breach and a rights request are written straight into the local
 * test database, so the walk is skipped against any other database).
 *
 * At each moment: the documents panel shows every document with its state,
 * the menu's line under each step says the same, the six area tiles carry the
 * menu's state words, and the dashboard has none of the removed pieces. Then
 * a browser that still holds the retired Classic cookie gets the same
 * dashboard (Classic was retired, decision d11).
 *
 * Runs in any project (desktop or phone width, any engine). DR_LOCALE=es walks
 * it in Spanish; DR_SHOTS=<dir> saves a screenshot at each stop.
 */

import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const stamp = Date.now().toString(36);
const LOCALE = process.env.DR_LOCALE === "es" ? "es" : "en";
const SHOTS = process.env.DR_SHOTS ?? "";
const es = LOCALE === "es";

function localDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return /@(localhost|127\.0\.0\.1|postgres)(:\d+)?\//.test(url);
}

async function shot(page: Page, name: string, project: string, fullPage = true) {
  if (!SHOTS) return;
  await page.waitForLoadState("networkidle").catch(() => {});
  // Let a side sheet finish sliding in before a viewport shot.
  if (!fullPage) await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${project}-${LOCALE}-${name}.png`, fullPage });
}

async function expectNoSidewaysScroll(page: Page, where: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${where}: page wider than the window`).toBeLessThanOrEqual(innerWidth);
}

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

/** Open the menu (the side sheet on a phone) and return its root. */
async function openMenu(page: Page) {
  if (wide(page)) return page.locator("aside nav").first();
  await page.getByRole("button", { name: /open the program path|abrir la ruta del programa/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeMenu(page: Page) {
  if (wide(page)) return;
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** The panel's states, by document id. */
async function panelStates(page: Page): Promise<Record<string, string>> {
  const panel = page.getByTestId("documents-panel");
  await expect(panel.locator("[data-state]").first()).toBeVisible();
  return panel.locator("li[data-state]").evaluateAll((rows) =>
    Object.fromEntries(
      rows.map((r) => [r.getAttribute("data-testid")!.replace(/^doc-/, ""), r.getAttribute("data-state")!]),
    ),
  );
}

/**
 * The menu says what the panel says: for every step line, each document it
 * names is on the panel with the same state words. Returns the lines read.
 */
async function expectMenuAgrees(page: Page): Promise<Record<string, string>> {
  const panel = page.getByTestId("documents-panel");
  const rows = await panel.locator("li[data-state]").evaluateAll((items) =>
    items.map((li) => ({
      name: (li.querySelector("p.font-medium")?.textContent ?? "").trim(),
      state: (li.querySelector("[data-testid^='doc-state-']")?.textContent ?? "").trim(),
      detail: (li.querySelector("p.text-xs")?.textContent ?? "").trim(),
      kind: li.getAttribute("data-state"),
    })),
  );
  const menu = await openMenu(page);
  // Open every stage, so every step line is in the page.
  const closed = menu.locator("button[aria-expanded='false']");
  for (let guard = 0; guard < 10 && (await closed.count()) > 0; guard++) {
    await closed.first().click();
  }
  const lines = await menu.locator("[data-testid^='step-docs-']").evaluateAll((spans) =>
    Object.fromEntries(spans.map((s) => [s.getAttribute("data-testid")!, (s.textContent ?? "").trim()])),
  );
  const notYet = (await menu.getByTestId("menu-not-yet").innerText()).trim();
  await closeMenu(page);
  expect(Object.keys(lines).length, "menu document lines").toBeGreaterThan(4);
  const all = Object.values(lines).join(" | ");
  for (const row of rows) {
    if (row.name === (es ? "Informe del programa de privacidad" : "Privacy programme report")) continue;
    const words = row.kind === "needsInput" ? row.detail : row.state;
    expect(all, `menu names ${row.name}`).toContain(`${row.name} · ${words}`);
  }
  // The foot group is the panel's last line.
  const panelNotYet = (await page.getByTestId("doc-not-yet").innerText()).trim();
  const names = panelNotYet.replace(/^[^:]+:\s*/, "").split(" · ");
  for (const name of names) expect(notYet).toContain(name);
  return lines;
}

async function expectRemovedPieces(page: Page) {
  await expect(page.getByTestId("guided-dashboard")).toBeVisible();
  await expect(page.getByTestId("kpi-assets")).toHaveCount(0);
  await expect(page.getByText(es ? /Actividad reciente/ : /Recent activity/)).toHaveCount(0);
  await expect(page.getByText(es ? /Acciones rápidas/ : /Quick actions/)).toHaveCount(0);
  await expect(page.getByTestId("area-tiles").locator("li")).toHaveCount(6);
}

test("documents you can produce today, the menu lines and the simpler dashboard", async ({ page, context }, testInfo) => {
  test.skip(!localDatabase(), "writes records into a local test database only");
  const project = testInfo.project.name;
  const orgName = `Register ${project} ${LOCALE} ${stamp}`;

  await page.goto("/sign-in");
  await page.locator("#local-email").fill(`register-${project}-${LOCALE}-${stamp}@example.com`);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(orgName);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
  await context.addCookies([{ name: "locale", value: LOCALE, url: new URL(page.url()).origin }]);

  // 1. The empty organisation.
  await page.goto("/privacy");
  await expectRemovedPieces(page);
  let states = await panelStates(page);
  expect(states.regulatoryReport).toBe("needsInput");
  expect(states.ropa).toBe("needsInput");
  expect(states.programmeReport).toBe("draft");
  // d5: on this self-hosted build the DPIA module is not installed.
  expect(states.dpia).toBe("needsInput");
  await expect(page.getByTestId("doc-dpia")).toContainText(es ? "necesita: el módulo de EIPD" : "needs: the DPIA module");
  await expect(page.getByTestId("doc-input-dpia")).toHaveAttribute("href", "/privacy/skills");
  await expect(page.getByTestId("doc-dpia")).not.toContainText(/[$€]\s?\d/);
  await expect(page.getByTestId("doc-not-yet")).toBeVisible();
  await expect(page.getByTestId("area-people")).toHaveAttribute("data-word", "coming");
  await expectMenuAgrees(page);
  await expectNoSidewaysScroll(page, "empty dashboard");
  await shot(page, "01-empty", project);
  if (!wide(page)) {
    await openMenu(page);
    await shot(page, "01b-empty-menu", project, false);
    await closeMenu(page);
  }

  // 2. The quick start: where it operates, then an industry template.
  await page.goto("/privacy/quickstart");
  await expect(page.getByTestId("jurisdiction-picker")).toBeVisible();
  await page.locator("#quickstart-place-CCPA").click();
  await page.locator("#quickstart-place-GDPR").click();
  await page.getByRole("button", { name: /^(save and continue|guardar y continuar)$/i }).click();
  const industryPath = page.getByRole("button", { name: /start from industry template|comenzar con una plantilla sectorial/i });
  await expect(industryPath).toBeVisible();
  await industryPath.press("Enter");
  await page.getByRole("button", { name: /^(continue|continuar)$/i }).click();
  const firstTemplate = page.locator('[role="button"][aria-pressed]').first();
  await expect(firstTemplate).toBeVisible();
  await firstTemplate.click();
  await page.getByRole("button", { name: /^(review|revisar)$/i }).click();
  await page.getByRole("button", { name: /build my privacy program|construir mi programa de privacidad/i }).click();
  await expect(page.getByTestId("quickstart-created")).toBeVisible({ timeout: 60_000 });

  await page.goto("/privacy");
  await expectRemovedPieces(page);
  states = await panelStates(page);
  expect(states.regulatoryReport).toBe("ready");
  expect(states.ropa).toBe("draft");
  await expect(page.getByTestId("doc-ropa")).toContainText(es ? "por confirmar" : "to confirm");
  await expect(page.getByTestId("area-setup")).toHaveAttribute("data-word", "done");
  await expect(page.getByTestId("area-inventory")).toHaveAttribute("data-word", "toConfirm");
  await expect(page.getByTestId("next-actions").getByTestId("next-action").first()).toBeVisible();
  const lines = await expectMenuAgrees(page);
  expect(lines["step-docs-applies"]).toContain(es ? "Informe normativo · listo" : "Regulatory report · ready");
  await expectNoSidewaysScroll(page, "dashboard after the quick start");
  await shot(page, "02-after-quickstart", project);
  if (!wide(page)) {
    await openMenu(page);
    await shot(page, "02b-after-quickstart-menu", project, false);
    await closeMenu(page);
  }

  // 3. Confirm every draft, then a vendor entered by hand, a breach with no
  // decision yet and a rights request.
  await page.goto("/privacy/review");
  await page.getByRole("button", { name: /^(select all|seleccionar todo)$/i }).click();
  await page.getByTestId("confirm-selected").click();
  await expect(page.getByTestId("review-empty")).toBeVisible();
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findFirstOrThrow({ where: { name: orgName } });
    await prisma.incident.create({
      data: {
        organizationId: org.id,
        title: `Walk breach ${stamp}`,
        description: "Logged by the browser walk.",
        type: "DATA_BREACH",
        discoveredAt: new Date(),
      },
    });
    await prisma.vendor.create({ data: { organizationId: org.id, name: `Walk vendor ${stamp}` } });
    await prisma.dSARRequest.create({
      data: {
        organizationId: org.id,
        type: "ACCESS",
        requesterName: "Walk requester",
        requesterEmail: `walk-${stamp}@example.com`,
        dueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  await page.goto("/privacy");
  await expectRemovedPieces(page);
  states = await panelStates(page);
  expect(states.vendorRegister).toBe("ready");
  expect(states.breachRegister).toBe("draft"); // no impact recorded yet
  expect(states.dsarPerformance).toBe("draft"); // one request open, none completed
  await expect(page.getByTestId("doc-ropa")).not.toContainText(es ? "por confirmar" : "to confirm");
  await expect(page.getByTestId("area-respond")).toHaveAttribute("data-word", "action");
  await expect(page.getByTestId("next-action").first()).toContainText(
    es ? "Brechas pendientes de decidir" : "Breaches waiting for a decision",
  );
  await expect(page.getByTestId("deadlines")).toContainText("INC-");
  await expect(page.getByTestId("deadlines")).toContainText(es ? "SOL-" : "REQ-");
  await expectMenuAgrees(page);
  const menu = await openMenu(page);
  await expect(menu.getByTestId("stage-word-respond")).toHaveText(es ? "requiere acción" : "needs action");
  await closeMenu(page);
  await expectNoSidewaysScroll(page, "dashboard after confirming and filling records");
  await shot(page, "03-confirmed-filled", project);
  if (!wide(page)) {
    await openMenu(page);
    await shot(page, "03b-confirmed-filled-menu", project, false);
    await closeMenu(page);
  }

  // Help keeps one line about experts.
  await page.getByTitle(es ? /Ayuda de esta página/i : /Help for this page/i).first().click();
  await expect(page.getByTestId("help-experts-line")).toBeVisible();
  await page.keyboard.press("Escape");

  // The retired Classic cookie is ignored: the same dashboard opens.
  await context.addCookies([{ name: "dpc_skin", value: "classic", url: new URL(page.url()).origin }]);
  await page.goto("/privacy");
  await expect(page.getByTestId("guided-dashboard")).toBeVisible();
  await expect(page.getByTestId("kpi-assets")).toHaveCount(0);
  await expectNoSidewaysScroll(page, "dashboard with the old classic cookie");
  await shot(page, "04-old-classic-cookie", project);
});
