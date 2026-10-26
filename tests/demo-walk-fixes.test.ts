// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Faults found walking a new hosted organisation end to end:
 *   - the ready-made TODO.LAW transfer assessment waited for approval with no
 *     approval request, so nobody could approve it;
 *   - a closed rights request showed its due date as the closing date;
 *   - the hosted first run never reached the quick start (every hosted
 *     organisation starts with TODO.LAW as a vendor);
 *   - raw codes, English law names and unfinished features on customer
 *     screens; a breach "not requiring notification" before anyone decided;
 *     contradictions on the provider's transfer page; one click closing a
 *     request with open tasks; exports answering in English JSON.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import {
  backfillTodoLawTiaApprovals,
  todoLawTiaApprover,
  TODOLAW_TIA_MARKER,
} from "@/server/services/todolaw-transfer-assessment";
import { localizeJurisdiction } from "@/config/jurisdiction-catalog";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

type Member = { organizationId: string; userId: string; role: string; createdAt: number };

function memberDb(members: Member[]) {
  return {
    organizationMember: {
      findMany: vi.fn(async ({ where }: { where: { organizationId: string; role: { in: string[] } } }) =>
        members
          .filter((m) => m.organizationId === where.organizationId && where.role.in.includes(m.role))
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(({ userId, role }) => ({ userId, role })),
      ),
    },
  };
}

describe("the ready-made transfer assessment can be approved", () => {
  it("asks the owner first, then an administrator, then a privacy officer", async () => {
    const db = memberDb([
      { organizationId: "o1", userId: "admin", role: "ADMIN", createdAt: 1 },
      { organizationId: "o1", userId: "owner", role: "OWNER", createdAt: 2 },
      { organizationId: "o2", userId: "officer", role: "PRIVACY_OFFICER", createdAt: 1 },
      { organizationId: "o2", userId: "member", role: "MEMBER", createdAt: 0 },
    ]);
    expect(await todoLawTiaApprover(db as never, "o1")).toBe("owner");
    expect(await todoLawTiaApprover(db as never, "o2")).toBe("officer");
    expect(await todoLawTiaApprover(db as never, "o3")).toBeNull();
  });

  it("creates the approval request in the same step as the assessment", () => {
    const src = read("src/server/services/todolaw-transfer-assessment.ts");
    const prefill = src.slice(src.indexOf("export async function prefillTodoLawTransfer"), src.indexOf("// ── Backfill"));
    expect(prefill).toContain("tx.assessmentApproval.create");
    expect(prefill).toContain("ApprovalStatus.PENDING");
    // Never approved on the organisation's behalf.
    expect(prefill).not.toContain("ApprovalStatus.APPROVED");
    expect(prefill).not.toContain("AssessmentStatus.APPROVED");
  });

  describe("the backfill", () => {
    const assessments = [
      { id: "a1", organizationId: "o1", status: "PENDING_APPROVAL", metadata: { source: "todo-law", [TODOLAW_TIA_MARKER]: "1" }, _count: { approvals: 0 } },
      { id: "a2", organizationId: "o2", status: "PENDING_APPROVAL", metadata: { source: "todo-law", [TODOLAW_TIA_MARKER]: "1" }, _count: { approvals: 1 } },
      { id: "a3", organizationId: "o3", status: "APPROVED", metadata: { source: "todo-law", [TODOLAW_TIA_MARKER]: "1" }, _count: { approvals: 1 } },
      { id: "a4", organizationId: "o4", status: "PENDING_APPROVAL", metadata: { source: "todo-law", [TODOLAW_TIA_MARKER]: "1" }, _count: { approvals: 0 } },
      // A TODO.LAW-sourced assessment that is not the ready-made TIA: ignored.
      { id: "a5", organizationId: "o1", status: "PENDING_APPROVAL", metadata: { source: "todo-law" }, _count: { approvals: 0 } },
    ];
    const members: Member[] = [
      { organizationId: "o1", userId: "owner-1", role: "OWNER", createdAt: 1 },
      { organizationId: "o2", userId: "owner-2", role: "OWNER", createdAt: 1 },
    ];
    const dbFor = () => {
      const create = vi.fn(async () => ({}));
      return {
        create,
        db: {
          ...memberDb(members),
          assessment: { findMany: vi.fn(async () => assessments) },
          assessmentApproval: { create },
        },
      };
    };

    it("reports, and writes nothing, on a dry run", async () => {
      const { db, create } = dbFor();
      const rows = await backfillTodoLawTiaApprovals(db as never, { execute: false });
      expect(rows).toEqual([
        { organizationId: "o1", outcome: "request" },
        { organizationId: "o2", outcome: "has-approval" },
        { organizationId: "o3", outcome: "not-pending" },
        { organizationId: "o4", outcome: "no-approver" },
      ]);
      expect(create).not.toHaveBeenCalled();
    });

    it("adds one pending request to the owner on execute", async () => {
      const { db, create } = dbFor();
      const rows = await backfillTodoLawTiaApprovals(db as never, { execute: true });
      expect(rows[0]).toEqual({ organizationId: "o1", outcome: "requested" });
      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: { assessmentId: "a1", approverId: "owner-1", level: 1, status: "PENDING" },
      });
    });

    it("has a guarded script that dry-runs by default", () => {
      const script = read("scripts/backfill-todolaw-tia-approval.ts");
      expect(script).toContain('process.argv.includes("--execute")');
      expect(script).toContain("ALLOWED_HOST_FRAGMENTS");
    });
  });
});

describe("a closed rights request shows when it was closed", () => {
  it("prints the completion date, not the due date, once closed", () => {
    const page = read("src/app/(dashboard)/privacy/dsar/[id]/page.tsx");
    expect(page).toMatch(/isCompleted \? \(request\.completedAt/);
  });
});

describe("the hosted first run reaches the quick start", () => {
  it("leaves TODO.LAW out of the vendor figure the redirect reads", () => {
    const router = read("src/server/routers/privacy/organization.ts");
    expect(router).toContain("ownActiveVendors");
    expect(router).toMatch(/OR: \[\{ sourceRef: null \}, \{ sourceRef: \{ not: TODOLAW_SOURCE_REF \} \}\]/);
    const page = read("src/app/(dashboard)/privacy/page.tsx");
    expect(page).toContain("stats?.ownActiveVendors ?? stats?.activeVendors");
  });
});

describe("words, not codes, on customer screens", () => {
  it("shows the relationship and the discovery method as words", () => {
    const dsar = read("src/app/(dashboard)/privacy/dsar/[id]/page.tsx");
    expect(dsar).toContain('useTranslations("dsarPublic.form.relationship")');
    expect(dsar).toContain('useTranslations("pages.newDsar.requester.relationshipOptions")');
    const incident = read("src/app/(dashboard)/privacy/incidents/[id]/page.tsx");
    expect(incident).toContain('useTranslations("pages.newIncident.discoveryMethodOption")');
    expect(incident).not.toContain('discoveryMethod?.replace("_", " ")');
    expect(read("src/server/services/export/documents/breach-register.ts")).toContain("discoveryMethodOption.");
    expect(read("src/app/(dashboard)/privacy/docs/page.tsx")).toContain("tRole(role)");
  });

  it("names the breach form's laws in Spanish on Spanish screens", () => {
    expect(read("src/app/(dashboard)/privacy/incidents/new/page.tsx")).toContain("localizeJurisdiction(");
    const gdpr = localizeJurisdiction({ code: "GDPR", region: "EU", name: "General Data Protection Regulation" }, "es");
    expect(gdpr.name).not.toBe("General Data Protection Regulation");
    expect(es.pages.newIncident.jurisdictionHint).toContain("LOPDGDD");
  });
});

describe("the breach's notification tab", () => {
  it("says the decision is still open while nobody has decided", () => {
    const page = read("src/app/(dashboard)/privacy/incidents/[id]/page.tsx");
    expect(page).toContain('authorityNotificationAssessment(incident) === "NOT_ASSESSED"');
    expect(es.pages.incidentDetail.notifications.undecidedHint).toMatch(/^Todavía no has decidido/);
    expect(en.pages.incidentDetail.notifications.undecidedHint).toMatch(/^You have not yet decided/);
  });
});

describe("no unfinished features on customer screens", () => {
  it("drops the empty Documents tab of a breach", () => {
    const page = read("src/app/(dashboard)/privacy/incidents/[id]/page.tsx");
    expect(page).not.toContain('value="documents"');
  });

  it("does not list modules that are not available", () => {
    const page = read("src/app/(dashboard)/privacy/billing/page.tsx");
    expect(page).toContain("const listedRows = addOnRows.filter((r) => !r.isComingSoon);");
    expect(page).toContain("{listedRows.map((row) => (");
  });

  it("leaves areas not covered yet out of the clients table", () => {
    const page = read("src/app/(dashboard)/privacy/clients/page.tsx");
    expect(page).toContain('row.areas.filter((area) => area.word !== "coming")');
  });
});

describe("the provider's transfer page agrees with itself", () => {
  const page = read("src/app/(dashboard)/privacy/transfers/[id]/page.tsx");
  it("mentions a partial adequacy decision only for a transfer that rests on it", () => {
    expect(page).toContain('const onAdequacy = transfer.mechanism === "ADEQUACY_DECISION";');
    expect(page).toContain('adequacyCoverage === "PARTIAL_UNCONFIRMED" && onAdequacy && adequacyDecision');
  });
  it("opens the existing assessment instead of offering to start one", () => {
    expect(page).toContain('transfer.tia ? t("openTia") : t("startTia")');
    expect(es.pages.transfers.detail.openTia).toBe("Abrir la EIT");
  });
  it("says the transfer waits for its assessment's approval instead of a contradicting suggestion", () => {
    expect(page).toContain("tiaAwaitingApproval ?");
    expect(es.pages.transfers.detail.tiaAwaitingApproval).toContain("EIT");
  });
});

describe("closing a rights request with open tasks", () => {
  it("asks first, from the button and from the status list", () => {
    const page = read("src/app/(dashboard)/privacy/dsar/[id]/page.tsx");
    expect(page).toContain("onClick={() => requestStatusChange(DSARStatus.COMPLETED)}");
    expect(page).toContain("onValueChange={(value) => requestStatusChange(value as DSARStatus)}");
    expect(page).toContain("open={isCompleteConfirmOpen}");
    expect(es.pages.dsarDetail.completeConfirm.confirm).toBe("Cerrar igualmente");
  });
});

describe("too many exports", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("allows a person to open every export in turn, then answers with a page in their language", async () => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "");
    const { exportLimiter } = await import("@/lib/rate-limit");
    expect(exportLimiter.config().limit).toBe(30);
    const { checkExportRateLimit } = await import("@/lib/api-export");
    const req = () => new Request("https://example.test/api/export/x", { headers: { cookie: "locale=es" } });
    for (let i = 0; i < 30; i++) expect(checkExportRateLimit(req(), "walk@example.test")).toBeNull();
    const res = checkExportRateLimit(req(), "walk@example.test");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("content-type")).toContain("text/html");
    const body = await res!.text();
    expect(body).toContain("Espera un momento");
    expect(body).not.toContain("{");
  });
});

describe("the new texts", () => {
  it("exist in both languages with no long dashes", () => {
    const pick = (m: typeof en) => [
      m.pages.incidentDetail.notifications.undecidedHint,
      m.pages.newIncident.jurisdictionHint,
      m.pages.transfers.detail.tiaOpenTitle,
      m.pages.transfers.detail.tiaOpenBody,
      m.pages.transfers.detail.openTia,
      m.pages.transfers.detail.tiaAwaitingApproval,
      m.pages.dsarDetail.completeConfirm.title,
      m.pages.dsarDetail.completeConfirm.description,
      m.pages.dsarDetail.completeConfirm.confirm,
    ];
    for (const m of [en, es]) for (const text of pick(m)) {
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/[—–]/);
    }
  });
});
