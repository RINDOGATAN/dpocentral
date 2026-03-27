import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { dispatchNotification } from "@/server/services/notifications/dispatcher";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Vercel Cron: daily notification checks (runs at 08:00 UTC)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized invocations
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const summary = {
    dsarDeadlineApproaching: 0,
    dsarOverdue: 0,
    incidentNotificationDeadline: 0,
    vendorContractExpiring: 0,
    assessmentOverdue: 0,
    transferSccExpiring: 0,
    dsarRedacted: 0,
    errors: 0,
  };

  try {
    const organizations = await prisma.organization.findMany({
      select: { id: true },
    });

    for (const org of organizations) {
      try {
        await checkDsarDeadlines(org.id, now, summary);
        await checkIncidentDeadlines(org.id, now, summary);
        await checkVendorContracts(org.id, now, summary);
        await checkAssessmentDueDates(org.id, now, summary);
        await checkTransferSccExpiry(org.id, now, summary);
        await autoRedactCompletedDsars(org.id, now, summary);
      } catch (err) {
        logger.error("Notification cron failed for org", err, { orgId: org.id });
        summary.errors++;
      }
    }
  } catch (err) {
    logger.error("Notification cron fatal error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  logger.info("Notification cron completed", summary as unknown as Record<string, unknown>);

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    summary,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysFromNow(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// DSAR deadline checks
// ---------------------------------------------------------------------------

async function checkDsarDeadlines(
  orgId: string,
  now: Date,
  summary: Record<string, number>,
) {
  // Active (non-terminal) DSARs with upcoming or past due dates
  const activeRequests = await prisma.dSARRequest.findMany({
    where: {
      organizationId: orgId,
      status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] },
    },
    select: {
      id: true,
      publicId: true,
      requesterName: true,
      dueDate: true,
      extendedDueDate: true,
    },
  });

  for (const req of activeRequests) {
    const effectiveDue = req.extendedDueDate ?? req.dueDate;
    const daysLeft = daysFromNow(effectiveDue, now);

    if (daysLeft < 0) {
      // Overdue
      await dispatchNotification(orgId, "DSAR_DEADLINE_OVERDUE", {
        title: "DSAR Overdue",
        message: `DSAR ${req.publicId} for ${req.requesterName} is ${Math.abs(daysLeft)} day(s) overdue.`,
        link: `/privacy/dsar/${req.id}`,
        metadata: { dsarId: req.id, daysOverdue: Math.abs(daysLeft) },
      });
      summary.dsarOverdue++;
    } else if (daysLeft <= 7) {
      // Approaching: 7d, 3d, 1d thresholds
      if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1 || daysLeft === 0) {
        await dispatchNotification(orgId, "DSAR_DEADLINE_APPROACHING", {
          title: "DSAR Deadline Approaching",
          message: `DSAR ${req.publicId} for ${req.requesterName} is due in ${daysLeft} day(s).`,
          link: `/privacy/dsar/${req.id}`,
          metadata: { dsarId: req.id, daysLeft },
        });
        summary.dsarDeadlineApproaching++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Incident notification deadline checks
// ---------------------------------------------------------------------------

async function checkIncidentDeadlines(
  orgId: string,
  now: Date,
  summary: Record<string, number>,
) {
  const incidents = await prisma.incident.findMany({
    where: {
      organizationId: orgId,
      notificationRequired: true,
      notificationDeadline: { not: null },
      status: { notIn: ["CLOSED", "FALSE_POSITIVE"] },
    },
    select: {
      id: true,
      publicId: true,
      title: true,
      notificationDeadline: true,
    },
  });

  for (const incident of incidents) {
    if (!incident.notificationDeadline) continue;
    const daysLeft = daysFromNow(incident.notificationDeadline, now);

    if (daysLeft <= 3 && daysLeft >= 0) {
      await dispatchNotification(orgId, "INCIDENT_NOTIFICATION_DEADLINE", {
        title: "Incident DPA Notification Deadline",
        message: `Incident "${incident.title}" (${incident.publicId}) has a DPA notification deadline in ${daysLeft} day(s).`,
        link: `/privacy/incidents/${incident.id}`,
        metadata: { incidentId: incident.id, daysLeft },
      });
      summary.incidentNotificationDeadline++;
    } else if (daysLeft < 0) {
      await dispatchNotification(orgId, "INCIDENT_NOTIFICATION_DEADLINE", {
        title: "Incident DPA Notification Overdue",
        message: `Incident "${incident.title}" (${incident.publicId}) DPA notification deadline was ${Math.abs(daysLeft)} day(s) ago.`,
        link: `/privacy/incidents/${incident.id}`,
        metadata: { incidentId: incident.id, daysOverdue: Math.abs(daysLeft) },
      });
      summary.incidentNotificationDeadline++;
    }
  }
}

// ---------------------------------------------------------------------------
// Vendor contract expiry checks (30d, 7d)
// ---------------------------------------------------------------------------

async function checkVendorContracts(
  orgId: string,
  now: Date,
  summary: Record<string, number>,
) {
  // Get all vendors for this org, then check their contracts
  const vendors = await prisma.vendor.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
    },
  });

  for (const vendor of vendors) {
    const contracts = await prisma.vendorContract.findMany({
      where: {
        vendorId: vendor.id,
        status: "ACTIVE",
        endDate: { not: null },
      },
      select: {
        id: true,
        name: true,
        endDate: true,
      },
    });

    for (const contract of contracts) {
      if (!contract.endDate) continue;
      const daysLeft = daysFromNow(contract.endDate, now);

      if (daysLeft === 30 || daysLeft === 7) {
        await dispatchNotification(orgId, "VENDOR_CONTRACT_EXPIRING", {
          title: "Vendor Contract Expiring",
          message: `Contract "${contract.name}" with ${vendor.name} expires in ${daysLeft} days.`,
          link: `/privacy/vendors/${vendor.id}`,
          metadata: { vendorId: vendor.id, contractId: contract.id, daysLeft },
        });
        summary.vendorContractExpiring++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Assessment due date checks
// ---------------------------------------------------------------------------

async function checkAssessmentDueDates(
  orgId: string,
  now: Date,
  summary: Record<string, number>,
) {
  const assessments = await prisma.assessment.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "PENDING_APPROVAL"] },
      dueDate: { not: null },
    },
    select: {
      id: true,
      name: true,
      dueDate: true,
    },
  });

  for (const assessment of assessments) {
    if (!assessment.dueDate) continue;
    const daysLeft = daysFromNow(assessment.dueDate, now);

    if (daysLeft < 0) {
      await dispatchNotification(orgId, "ASSESSMENT_OVERDUE", {
        title: "Assessment Overdue",
        message: `Assessment "${assessment.name}" is ${Math.abs(daysLeft)} day(s) overdue.`,
        link: `/privacy/assessments/${assessment.id}`,
        metadata: { assessmentId: assessment.id, daysOverdue: Math.abs(daysLeft) },
      });
      summary.assessmentOverdue++;
    }
  }
}

// ---------------------------------------------------------------------------
// Transfer SCC expiry checks (30d)
// ---------------------------------------------------------------------------

async function checkTransferSccExpiry(
  orgId: string,
  now: Date,
  summary: Record<string, number>,
) {
  const transfers = await prisma.dataTransfer.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      sccExpiryDate: { not: null },
    },
    select: {
      id: true,
      name: true,
      destinationCountry: true,
      sccExpiryDate: true,
    },
  });

  for (const transfer of transfers) {
    if (!transfer.sccExpiryDate) continue;
    const daysLeft = daysFromNow(transfer.sccExpiryDate, now);

    if (daysLeft === 30 || daysLeft === 7) {
      await dispatchNotification(orgId, "TRANSFER_SCC_EXPIRING", {
        title: "Transfer SCC Expiring",
        message: `Standard Contractual Clauses for "${transfer.name}" (to ${transfer.destinationCountry}) expire in ${daysLeft} days.`,
        link: `/privacy/data-inventory/transfers/${transfer.id}`,
        metadata: { transferId: transfer.id, daysLeft },
      });
      summary.transferSccExpiring++;
    }
  }
}

// ---------------------------------------------------------------------------
// DSAR PII Auto-Redaction
// ---------------------------------------------------------------------------
// Redacts personal data from completed DSARs after the retention period.
// Default: 90 days post-completion. Configurable per-org via intake form settings.

async function autoRedactCompletedDsars(
  organizationId: string,
  now: Date,
  summary: { dsarRedacted: number },
) {
  // Get org retention setting (from intake form, default 90 days)
  const intakeForm = await prisma.dSARIntakeForm.findFirst({
    where: { organizationId },
    select: { retentionDays: true },
  });
  const retentionDays = intakeForm?.retentionDays ?? 90;

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  // Find completed DSARs past retention that haven't been redacted
  const expiredRequests = await prisma.dSARRequest.findMany({
    where: {
      organizationId,
      status: { in: ["COMPLETED", "CANCELLED", "REJECTED"] },
      completedAt: { lt: cutoff },
      redactedAt: null,
    },
    select: { id: true },
  });

  for (const req of expiredRequests) {
    await prisma.dSARRequest.update({
      where: { id: req.id },
      data: {
        requesterName: "REDACTED",
        requesterEmail: "redacted@redacted",
        requesterPhone: null,
        requesterAddress: null,
        description: null,
        requestedData: null,
        responseNotes: null,
        redactedAt: now,
      },
    });

    await prisma.dSARCommunication.updateMany({
      where: { dsarRequestId: req.id },
      data: { content: "REDACTED", subject: null },
    });

    await prisma.dSARTask.updateMany({
      where: { dsarRequestId: req.id },
      data: { notes: null, description: null },
    });

    await prisma.dSARAuditLog.create({
      data: {
        dsarRequestId: req.id,
        action: "PII_AUTO_REDACTED",
        performedBy: "SYSTEM",
        details: { retentionDays, completedBefore: cutoff.toISOString() },
      },
    });

    summary.dsarRedacted++;
  }
}
