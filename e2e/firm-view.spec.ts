// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The firm view and the document pack (owner's decisions, 9 October 2026,
 * steps 4 and 5), seen in a browser by a consultancy with three clients at
 * different stages:
 *
 *   - one through the quick start, its drafts confirmed, a vendor, and a
 *     breach logged now with no decision on notifying (a 72-hour window);
 *   - one with only where it operates and a rights request due in ten days;
 *   - one just added, empty.
 *
 * All clients must list them by the nearest deadline (breach, request, none),
 * and each row's figure, documents ready and deadline must match the
 * client's own dashboard. Then the dashboard's "Download ready documents"
 * gives a ZIP with the right files and its index, with and without drafts.
 *
 * Records are written straight into the local test database, so the walk is
 * skipped against any other database. FV_LOCALE=es walks it in Spanish;
 * FV_OUT=<dir> saves screenshots, the ZIPs and their listings.
 */

import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const stamp = Date.now().toString(36);
const LOCALE = process.env.FV_LOCALE === "es" ? "es" : "en";
const OUT = process.env.FV_OUT ?? "";
const es = LOCALE === "es";

function localDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return /@(localhost|127\.0\.0\.1|postgres)(:\d+)?\//.test(url);
}

const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;

async function shot(page: Page, name: string, project: string) {
  if (!OUT) return;
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: path.join(OUT, `${project}-${LOCALE}-${name}.png`), fullPage: true });
}

async function expectNoSidewaysScroll(page: Page, where: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${where}: page wider than the window`).toBeLessThanOrEqual(innerWidth);
}

/** The names and contents of a stored ZIP. */
function readZip(zip: Buffer): Map<string, Buffer> {
  const endAt = zip.length - 22;
  expect(zip.readUInt32LE(endAt)).toBe(0x06054b50);
  const count = zip.readUInt16LE(endAt + 10);
  let p = zip.readUInt32LE(endAt + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const localNameLen = zip.readUInt16LE(local + 26);
    out.set(name, zip.subarray(local + 30 + localNameLen, local + 30 + localNameLen + size));
    p += 46 + nameLen;
  }
  return out;
}

interface RowReading {
  name: string;
  figure: string;
  docs: string;
  deadline: string;
}

/** The firm view's rows, in the order shown (table or cards). */
async function readRows(page: Page): Promise<RowReading[]> {
  const selector = wide(page) ? "[data-testid='client-row']" : "[data-testid='client-card']";
  await expect(page.locator(selector).first()).toBeVisible();
  return page.locator(selector).evaluateAll((rows) =>
    rows.map((row) => ({
      name: row.getAttribute("data-client") ?? "",
      figure: (row.querySelector("[data-testid='program-figure']")?.textContent ?? "").trim(),
      docs: (row.querySelector("[data-testid='client-docs']")?.textContent ?? "").trim(),
      deadline: (row.querySelector("[data-testid='client-deadline']")?.textContent ?? "").trim(),
    })),
  );
}

test("the firm view by nearest deadline, and the document pack", async ({ page, context }, testInfo) => {
  test.skip(!localDatabase(), "writes records into a local test database only");
  const project = testInfo.project.name;
  if (OUT) mkdirSync(OUT, { recursive: true });
  const names = {
    breach: `Harbour Bakery ${stamp}`,
    request: `Eastgate Physiotherapy ${stamp}`,
    empty: `Northside Dental ${stamp}`,
  };

  // The consultant and the first client, through the onboarding.
  await page.goto("/sign-in");
  await page.locator("#local-email").fill(`firm-${project}-${LOCALE}-${stamp}@example.com`);
  await page.locator("form").filter({ has: page.locator("#local-email") }).getByRole("button").click();
  await page.waitForURL("**/privacy**");
  await page.getByText(/business owner/i).first().click();
  await page.locator("#onboarding-org-name").fill(names.breach);
  await page.getByRole("button", { name: /get started/i }).click();
  await page.waitForURL("**/privacy/quickstart**");
  await context.addCookies([{ name: "locale", value: LOCALE, url: new URL(page.url()).origin }]);

  // Client 1: the quick start, every draft confirmed.
  await page.goto("/privacy/quickstart");
  await expect(page.getByTestId("jurisdiction-picker")).toBeVisible();
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
  await page.goto("/privacy/review");
  await page.getByRole("button", { name: /^(select all|seleccionar todo)$/i }).click();
  await page.getByTestId("confirm-selected").click();
  await expect(page.getByTestId("review-empty")).toBeVisible();

  // The records the walk cannot add quickly by hand, and the other two clients.
  const prisma = new PrismaClient();
  try {
    const first = await prisma.organization.findFirstOrThrow({ where: { name: names.breach } });
    const member = await prisma.organizationMember.findFirstOrThrow({ where: { organizationId: first.id } });
    await prisma.incident.create({
      data: {
        organizationId: first.id,
        title: `Walk breach ${stamp}`,
        description: "Logged by the browser walk.",
        type: "DATA_BREACH",
        discoveredAt: new Date(),
      },
    });
    await prisma.vendor.create({ data: { organizationId: first.id, name: `Walk vendor ${stamp}` } });

    const gdpr = await prisma.jurisdiction.findFirstOrThrow({ where: { code: "GDPR" } });
    const second = await prisma.organization.create({
      data: {
        name: names.request,
        slug: `eastgate-${project}-${LOCALE}-${stamp}`,
        members: { create: { userId: member.userId, role: "OWNER" } },
        jurisdictions: { create: { jurisdictionId: gdpr.id, isPrimary: true } },
      },
    });
    await prisma.dSARRequest.create({
      data: {
        organizationId: second.id,
        type: "ACCESS",
        requesterName: "Walk requester",
        requesterEmail: `walk-${stamp}@example.com`,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.organization.create({
      data: {
        name: names.empty,
        slug: `northside-${project}-${LOCALE}-${stamp}`,
        members: { create: { userId: member.userId, role: "OWNER" } },
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  // All clients: the nearest deadline first.
  await page.goto("/privacy/clients");
  const rows = await readRows(page);
  expect(rows.map((r) => r.name)).toEqual([names.breach, names.request, names.empty]);
  expect(rows[0].deadline).toContain("INC-");
  expect(rows[1].deadline).toContain(es ? "SOL-" : "REQ-");
  expect(rows[2].deadline).toBe(es ? "Ninguno" : "None");
  await expect(page.getByText(es ? "Añadir un cliente" : "Add a client")).toBeVisible();
  if (wide(page)) {
    await expect(page.getByTestId("clients-table")).toBeVisible();
    await expect(page.getByTestId("clients-cards")).toBeHidden();
    // The table stays inside its card.
    const fits = await page
      .getByTestId("clients-table")
      .evaluate((t) => t.scrollWidth <= (t.parentElement as HTMLElement).clientWidth + 1);
    expect(fits, "table fits its card").toBe(true);
  } else {
    await expect(page.getByTestId("clients-cards")).toBeVisible();
    await expect(page.getByTestId("clients-table")).toBeHidden();
  }
  await expectNoSidewaysScroll(page, "all clients");
  await shot(page, "01-all-clients", project);

  // Each row matches its client's own dashboard.
  for (const [i, row] of rows.entries()) {
    await page.goto("/privacy/clients");
    const container = page.locator(wide(page) ? "[data-testid='client-row']" : "[data-testid='client-card']").nth(i);
    await container.getByTestId("client-open").click();
    await page.waitForURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(row.name);
    const figure = (await page.getByTestId("program-figure-card").getByTestId("program-figure").innerText()).trim();
    expect(figure, `${row.name}: figure`).toBe(row.figure);
    const panel = page.getByTestId("documents-panel");
    await expect(panel.locator("li[data-state]").first()).toBeVisible();
    const ready = await panel.locator("li[data-state='ready']").count();
    const total = await panel.locator("li[data-state]").count();
    expect(row.docs, `${row.name}: documents`).toBe(es ? `${ready} de ${total} listos` : `${ready} of ${total} ready`);
    const deadlines = (await page.getByTestId("deadlines").innerText()).trim();
    const ref = row.deadline.match(/(INC|REQ|SOL)-[A-Z0-9]{6}/)?.[0];
    if (ref) expect(deadlines, `${row.name}: deadline`).toContain(ref);
    if (i === 0) await shot(page, "02-dashboard-with-pack-button", project);
  }

  // The document pack, from the first client's dashboard.
  await page.goto("/privacy/clients");
  await page
    .locator(wide(page) ? "[data-testid='client-row']" : "[data-testid='client-card']")
    .first()
    .getByTestId("client-open")
    .click();
  await page.waitForURL(/\/privacy$/);
  const panel = page.getByTestId("documents-panel");
  await expect(panel.locator("li[data-state]").first()).toBeVisible();
  const readyIds = await panel
    .locator("li[data-state='ready']")
    .evaluateAll((items) => items.map((li) => li.getAttribute("data-testid")!.replace(/^doc-/, "")));
  const draftIds = await panel
    .locator("li[data-state='draft']")
    .evaluateAll((items) => items.map((li) => li.getAttribute("data-testid")!.replace(/^doc-/, "")));
  await expect(page.getByTestId("pack-link")).toBeVisible();

  const listings: string[] = [];
  for (const withDrafts of [false, true]) {
    if (withDrafts) {
      test.skip(draftIds.length === 0, "no draft to include");
      await page.getByTestId("pack-drafts").click();
      await expect(page.getByTestId("pack-link")).toHaveAttribute("href", /drafts=1/);
    }
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("pack-link").click()]);
    const file = OUT
      ? path.join(OUT, `${project}-${LOCALE}-pack${withDrafts ? "-with-drafts" : ""}.zip`)
      : testInfo.outputPath(`pack-${withDrafts}.zip`);
    await download.saveAs(file);
    expect(download.suggestedFilename()).toMatch(es ? /^Paquete-de-documentos-harbour-bakery/ : /^Document-Pack-harbour-bakery/);
    const zip = readZip(readFileSync(file));
    const files = [...zip.keys()];
    listings.push(`# ${path.basename(file)}`, ...files.map((f) => `${String(zip.get(f)!.length).padStart(9)}  ${f}`), "");

    expect(files[0]).toBe(es ? "00-INDICE.md" : "00-INDEX.md");
    expect(files.at(-1)).toBe(es ? "99-MANIFIESTO.txt" : "99-MANIFEST.txt");
    const index = zip.get(files[0])!.toString("utf8");
    const manifest = zip.get(files.at(-1)!)!.toString("utf8");
    for (const f of files.slice(0, -1)) expect(manifest).toContain(` | ${f}`);
    // Every PDF is a PDF.
    for (const f of files.filter((n) => n.endsWith(".pdf"))) expect(zip.get(f)!.subarray(0, 4).toString()).toBe("%PDF");
    // The ready documents are in, unmarked; the regulatory report among them.
    expect(readyIds).toContain("regulatoryReport");
    expect(files.some((f) => /^\d\d-(regulatory-report|informe-normativo)\.pdf$/.test(f))).toBe(true);
    expect(index).toContain(es ? "| Informe normativo | listo |" : "| Regulatory report | ready |");
    const mark = es ? "BORRADOR" : "DRAFT";
    if (!withDrafts) {
      expect(files.some((f) => f.includes(`${mark}-`))).toBe(false);
      expect(index).toContain(es ? "no se han pedido los borradores" : "drafts were not asked for");
    } else {
      // Each draft of the panel is in, marked in its file name and its index row.
      expect(files.some((f) => f.includes(`${mark}-`))).toBe(true);
      expect(index).toContain(es ? "| borrador:" : "| draft:");
    }
    if (OUT) writeFileSync(path.join(OUT, `${project}-${LOCALE}-index${withDrafts ? "-with-drafts" : ""}.md`), index);
  }
  if (OUT) writeFileSync(path.join(OUT, `${project}-${LOCALE}-zip-listing.txt`), listings.join("\n"));
  await expectNoSidewaysScroll(page, "dashboard with the pack button");
});
