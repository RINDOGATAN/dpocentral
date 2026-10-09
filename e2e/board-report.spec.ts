// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The board report (owner's decision d12, 9 October 2026), seen in a browser:
 * an organisation with one confirmed step and a few records of the last
 * quarter (written straight into the local test database, so the walk is
 * skipped against any other database). It checks:
 *
 * - the dashboard's documents panel and the menu line under "Report to
 *   management" (now "Executive report") call the report ready, with its PDF;
 * - "At a glance" at the top: the programme ring and the four figures;
 * - the page shows the period (the last full quarter by default), the
 *   programme figure and the six areas, documents, incidents notified within
 *   72 hours, rights requests, vendors, assessments, risks and actions;
 * - the period can be changed, the DPO's comment is saved with the report and
 *   comes back after a reload;
 * - the PDF downloads in English and Spanish, two or three pages each;
 * - no sideways scroll at any width.
 *
 * Runs in any project (desktop or phone width, any engine). BR_LOCALE=es
 * walks it in Spanish; BR_SHOTS=<dir> saves screenshots and the PDFs there.
 */

import { writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const stamp = Date.now().toString(36);
const LOCALE = process.env.BR_LOCALE === "es" ? "es" : "en";
const SHOTS = process.env.BR_SHOTS ?? "";
const es = LOCALE === "es";
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function localDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return /@(localhost|127\.0\.0\.1|postgres)(:\d+)?\//.test(url);
}

async function shot(page: Page, name: string, project: string) {
  if (!SHOTS) return;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${project}-${LOCALE}-${name}.png`, fullPage: true });
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

/** The last full calendar quarter, as the page computes it (UTC). */
function lastQuarter(now = new Date()) {
  const y = now.getUTCFullYear();
  const q = now.getUTCMonth() - (now.getUTCMonth() % 3);
  const from = new Date(Date.UTC(y, q - 3, 1));
  const to = new Date(Date.UTC(y, q, 0));
  return { from, to };
}

test("the board report: page, comment, period, menu line, panel and PDF", async ({ page, context }, testInfo) => {
  test.skip(!localDatabase(), "writes records into a local test database only");
  const project = testInfo.project.name;
  const orgName = `Board ${project} ${LOCALE} ${stamp}`;

  await page.goto("/sign-in");
  await page.locator("#local-email").fill(`board-${project}-${LOCALE}-${stamp}@example.com`);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(orgName);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
  await context.addCookies([{ name: "locale", value: LOCALE, url: new URL(page.url()).origin }]);

  // Before any confirmed step, the panel says what the report needs.
  await page.goto("/privacy");
  await expect(page.getByTestId("doc-boardReport")).toHaveAttribute("data-state", "needsInput");
  await expect(page.getByTestId("doc-boardReport")).toContainText(
    es ? "un paso confirmado en la ruta" : "a confirmed step on the path",
  );

  // One confirmed step: where the organisation operates.
  await page.goto("/privacy/quickstart");
  await expect(page.getByTestId("jurisdiction-picker")).toBeVisible();
  await page.locator("#quickstart-place-GDPR").click();
  await page.getByRole("button", { name: /^(save and continue|guardar y continuar)$/i }).click();
  await expect(
    page.getByRole("button", { name: /start from industry template|comenzar con una plantilla sectorial/i }),
  ).toBeVisible();

  // Records of the last quarter.
  const { from } = lastQuarter();
  const inQuarter = new Date(from.getTime() + 10 * DAY);
  const prisma = new PrismaClient();
  let orgId = "";
  try {
    const org = await prisma.organization.findFirstOrThrow({ where: { name: orgName } });
    orgId = org.id;
    const jurisdiction = await prisma.jurisdiction.findFirstOrThrow();
    const onTime = await prisma.incident.create({
      data: {
        organizationId: org.id,
        title: `Board breach A ${stamp}`,
        description: "Logged by the browser walk.",
        type: "DATA_BREACH",
        discoveredAt: inQuarter,
        notificationRequired: true,
        affectedRecords: 120,
        status: "CLOSED",
      },
    });
    await prisma.incidentNotification.create({
      data: {
        incidentId: onTime.id,
        jurisdictionId: jurisdiction.id,
        recipientType: "DPA",
        status: "SENT",
        deadline: new Date(inQuarter.getTime() + 72 * HOUR),
        sentAt: new Date(inQuarter.getTime() + 30 * HOUR),
      },
    });
    await prisma.incident.create({
      data: {
        organizationId: org.id,
        title: `Board breach B ${stamp}`,
        description: "Logged by the browser walk.",
        type: "UNAUTHORIZED_ACCESS",
        discoveredAt: new Date(inQuarter.getTime() + 5 * DAY),
        notificationRequired: true,
        affectedRecords: 3,
        status: "INVESTIGATING",
      },
    });
    const dpaVendor = await prisma.vendor.create({
      data: { organizationId: org.id, name: `Board mailer ${stamp}`, status: "ACTIVE", riskTier: "MEDIUM" },
    });
    await prisma.vendorContract.create({
      data: { vendorId: dpaVendor.id, type: "DPA", status: "ACTIVE", name: "DPA" },
    });
    await prisma.vendor.create({
      data: { organizationId: org.id, name: `Board cloud ${stamp}`, status: "ACTIVE", riskTier: "HIGH" },
    });
    await prisma.dSARRequest.create({
      data: {
        organizationId: org.id,
        type: "ACCESS",
        status: "COMPLETED",
        requesterName: "Walk requester",
        requesterEmail: `walk-a-${stamp}@example.com`,
        receivedAt: inQuarter,
        dueDate: new Date(inQuarter.getTime() + 30 * DAY),
        completedAt: new Date(inQuarter.getTime() + 12 * DAY),
      },
    });
    await prisma.dSARRequest.create({
      data: {
        organizationId: org.id,
        type: "ERASURE",
        status: "IN_PROGRESS",
        requesterName: "Walk requester",
        requesterEmail: `walk-b-${stamp}@example.com`,
        receivedAt: inQuarter,
        dueDate: new Date(inQuarter.getTime() + 30 * DAY),
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  // The panel and the menu line: ready, with its PDF.
  await page.goto("/privacy");
  await expect(page.getByTestId("doc-boardReport")).toHaveAttribute("data-state", "ready");
  await expect(page.getByTestId("doc-download-boardReport-pdf")).toBeVisible();
  if (!wide(page)) {
    await page.getByRole("button", { name: /open the program path|abrir la ruta del programa/i }).click();
  }
  const menu = wide(page) ? page.locator("aside nav").first() : page.getByRole("dialog");
  const closed = menu.locator("li > button[aria-expanded='false']");
  for (let guard = 0; guard < 10 && (await closed.count()) > 0; guard++) await closed.first().click();
  await expect(menu.getByTestId("step-docs-audits")).toContainText(
    es ? "Informe ejecutivo · listo" : "Executive report · ready",
  );
  await expect(menu.getByTestId("menu-not-yet")).not.toContainText(es ? "Informe ejecutivo" : "Executive report");
  await menu.getByRole("link", { name: es ? /Informe ejecutivo/ : /Executive report/ }).first().click();
  await page.waitForURL("**/privacy/board-report**");

  // The page.
  const report = page.getByTestId("board-report");
  await expect(report).toBeVisible();
  await expect(page.getByTestId("board-period-line")).toContainText(es ? "Periodo: del 1 de" : "Period: 1 ");
  await expect(page.getByTestId("board-figure")).toContainText(es ? "pasos confirmados" : "steps confirmed");
  await expect(page.getByRole("heading", { level: 1, name: es ? "Informe ejecutivo" : "Executive report" })).toBeVisible();
  // At a glance: one breach of two notifiable within 72 hours, one request of one on time, one vendor of two with a DPA.
  const kpis = page.getByTestId("board-kpis");
  await expect(kpis).toContainText(es ? "De un vistazo" : "At a glance");
  await expect(page.getByTestId("board-kpi-breaches-value")).toHaveText("1");
  await expect(page.getByTestId("board-kpi-breaches")).toContainText(es ? "de 2" : "of 2");
  await expect(page.getByTestId("board-kpi-breaches-flag")).toContainText(es ? "1 fuera de plazo o sin notificar" : "1 late or not notified yet");
  await expect(page.getByTestId("board-kpi-rights")).toContainText(es ? "de 1" : "of 1");
  await expect(page.getByTestId("board-kpi-rights-flag")).toBeVisible();
  await expect(page.getByTestId("board-kpi-vendors-flag")).toContainText(
    es ? "1 de riesgo alto o crítico sin ese contrato" : "1 high or critical risk without one",
  );
  await expect(page.getByTestId("board-programme").locator("dt")).toHaveCount(6);
  const incidents = page.getByTestId("board-incidents");
  await expect(incidents).toContainText(es ? "Notificados a la autoridad en 72 horas" : "Notified to the authority within 72 hours");
  const incidentValues = await incidents.locator("dd").allInnerTexts();
  expect(incidentValues.map((v) => v.trim())).toEqual(["2", "1", "0", "1", "1"]);
  const rights = await page.getByTestId("board-rights").locator("dd").allInnerTexts();
  expect(rights.map((v) => v.trim())).toEqual(["2", "1", "0", "1", "0", "0"]);
  const vendors = await page.getByTestId("board-vendors").locator("dd").allInnerTexts();
  expect(vendors.map((v) => v.trim())).toEqual(["2", "1", "1"]);
  await expect(page.getByTestId("board-assessments")).toContainText(es ? "EIPD" : "DPIA");
  await expect(page.getByTestId("board-risks").locator("li").first()).toBeVisible();
  await expect(page.getByTestId("board-action").first()).toBeVisible();
  await expect(page.getByTestId("board-disclaimer")).toContainText(es ? "No es asesoramiento jurídico" : "not legal advice");
  await expect(report).not.toContainText(/\bcompliant\b|\bcumple\b/i);
  await expectNoSidewaysScroll(page, "board report");
  await shot(page, "01-board-report", project);

  // The comment, saved with the report, back after a reload.
  const comment = es
    ? "El trimestre cerró con una brecha notificada a tiempo. Pido aprobar el contrato que falta."
    : "The quarter closed with one breach notified on time. I ask the board to approve the missing agreement.";
  await page.getByTestId("board-comment-text").fill(comment);
  await page.getByTestId("board-comment-save").click();
  await expect(page.getByTestId("board-comment-saved")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("board-comment-text")).toHaveValue(comment);
  await shot(page, "02-comment-saved", project);

  // Another period: last month; the address carries it.
  await page.getByTestId("board-period").click();
  await page.getByRole("option", { name: es ? "Último mes" : "Last month" }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-01/);
  await expect(page.getByTestId("board-comment-text")).toHaveValue("");
  await expectNoSidewaysScroll(page, "board report, last month");
  await page.getByTestId("board-period").click();
  await page.getByRole("option", { name: es ? "Último trimestre" : "Last quarter" }).click();
  await expect(page.getByTestId("board-comment-text")).toHaveValue(comment);

  // The PDF, in English and Spanish.
  for (const lang of ["en", "es"] as const) {
    const response = await page.request.get(`/api/export/board-report?organizationId=${orgId}&locale=${lang}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const body = await response.body();
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    const pages = (body.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    expect(pages, `${lang} PDF pages`).toBeGreaterThanOrEqual(2);
    expect(pages, `${lang} PDF pages`).toBeLessThanOrEqual(3);
    expect(response.headers()["content-disposition"]).toContain(lang === "es" ? "Informe-Ejecutivo-" : "Executive-Report-");
    if (SHOTS) writeFileSync(`${SHOTS}/${project}-${LOCALE}-executive-report-${lang}.pdf`, body);
  }
});
