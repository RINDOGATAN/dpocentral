// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * An assessment waiting for approval: the named approver can approve or reject
 * from the page header (the Approvals tab keeps the full list), and anyone else
 * sees who it is waiting for. Same mutation and reject dialog as the tab.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const page = readFileSync("src/app/(dashboard)/privacy/assessments/[id]/page.tsx", "utf8");
const header = page.slice(page.indexOf("{/* Header */}"), page.indexOf("{/* Progress Overview */}"));

describe("approval actions in the assessment header", () => {
  it("shows Approve and Reject to the pending approver only", () => {
    expect(page).toMatch(/pendingApproval\.approver\?\.id === currentUserId/);
    expect(header).toContain("{myPendingApproval && (");
    expect(header).toContain('data-testid="header-approve"');
    expect(header).toContain('data-testid="header-reject"');
  });

  it("reuses the existing mutation and reject dialog", () => {
    expect(header).toMatch(/processApproval\.mutate\(\{[\s\S]*?approvalId: myPendingApproval\.id,[\s\S]*?decision: "APPROVED"/);
    expect(header).toMatch(/setRejectApprovalId\(myPendingApproval\.id\);[\s\S]*?setRejectDialogOpen\(true\)/);
  });

  it("tells everyone else who the approval is waiting for", () => {
    expect(page).toContain('data-testid="waiting-for-approver"');
    expect(page).toContain('tp("approvals.waitingFor"');
  });

  it("has the line in both languages, without long dashes", () => {
    const enText = en.pages.assessmentDetail.approvals.waitingFor;
    const esText = es.pages.assessmentDetail.approvals.waitingFor;
    expect(enText).toBe("Waiting for approval by {name}.");
    expect(esText).toBe("Pendiente de aprobación por {name}.");
    for (const s of [enText, esText]) expect(s).not.toMatch(/[–—]/);
  });

  it("keeps the Approvals tab", () => {
    expect(page).toContain('<TabsContent value="approvals"');
  });
});
