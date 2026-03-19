import { NotificationEventType } from "@prisma/client";
import { Resend } from "resend";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPayload {
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Specific user IDs to notify. When omitted every org member is notified. */
  recipientUserIds?: string[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
}

// ---------------------------------------------------------------------------
// Resend client (lazy — only instantiated when RESEND_API_KEY is set)
// ---------------------------------------------------------------------------

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

const EMAIL_FROM = process.env.EMAIL_FROM || "DPO Central <notifications@dpocentral.com>";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch (or create) a user's preference for a given event type + org.
 * Returns the preference row so callers can check each channel flag.
 */
async function getOrCreatePreference(
  userId: string,
  organizationId: string,
  eventType: NotificationEventType,
) {
  const existing = await prisma.notificationPreference.findUnique({
    where: {
      userId_organizationId_eventType: {
        userId,
        organizationId,
        eventType,
      },
    },
  });

  if (existing) return existing;

  // Default: in-app + email enabled, Slack disabled
  return prisma.notificationPreference.create({
    data: {
      userId,
      organizationId,
      eventType,
      inAppEnabled: true,
      emailEnabled: true,
      slackEnabled: false,
    },
  });
}

/**
 * Read the Slack webhook URL from Organization.settings JSON.
 */
async function getSlackWebhookUrl(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  if (!org?.settings || typeof org.settings !== "object") return null;
  const settings = org.settings as Record<string, unknown>;
  const url = settings.slackWebhookUrl;
  return typeof url === "string" && url.startsWith("https://") ? url : null;
}

// ---------------------------------------------------------------------------
// Channel senders
// ---------------------------------------------------------------------------

async function sendInApp(
  userId: string,
  organizationId: string,
  eventType: NotificationEventType,
  payload: NotificationPayload,
) {
  await prisma.notification.create({
    data: {
      organizationId,
      userId,
      type: eventType,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      metadata: payload.metadata ? JSON.parse(JSON.stringify(payload.metadata)) : undefined,
    },
  });
}

async function sendEmail(
  userEmail: string,
  userName: string | null,
  payload: NotificationPayload,
) {
  const resend = getResend();
  if (!resend) {
    logger.warn("Email notification skipped — RESEND_API_KEY not configured");
    return;
  }

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: userEmail,
      subject: payload.title,
      html: buildEmailHtml(userName, payload),
    });
  } catch (err) {
    logger.error("Failed to send email notification", err, { to: userEmail });
  }
}

function buildEmailHtml(userName: string | null, payload: NotificationPayload): string {
  const greeting = userName ? `Hi ${userName},` : "Hi,";
  const linkHtml = payload.link
    ? `<p><a href="${process.env.NEXTAUTH_URL || "https://privacysuite-ten.vercel.app"}${payload.link}" style="color:#2563eb;">View details &rarr;</a></p>`
    : "";

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <p>${greeting}</p>
      <p>${payload.message}</p>
      ${linkHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:12px;">
        You received this because of your notification preferences in DPO Central.
        You can update them in Settings &gt; Notifications.
      </p>
    </div>
  `.trim();
}

/**
 * Post a message to the organization's configured Slack webhook.
 * Slack webhooks are a premium feature — this is a no-op if the URL is not set.
 */
export async function sendSlackMessage(
  webhookUrl: string,
  payload: NotificationPayload,
) {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${payload.title}*\n${payload.message}` },
    },
  ];

  if (payload.link) {
    const baseUrl = process.env.NEXTAUTH_URL || "https://privacysuite-ten.vercel.app";
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `<${baseUrl}${payload.link}|View details>` },
    });
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("Slack webhook delivery failed", undefined, {
      status: res.status,
      body: body.slice(0, 200),
    });
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Central notification dispatcher.
 *
 * For each recipient the function:
 * 1. Resolves (or creates) the user's NotificationPreference for this event type.
 * 2. Creates an in-app Notification record (if enabled).
 * 3. Sends an email via Resend (if enabled).
 * 4. Posts to the org's Slack webhook (premium — if enabled & configured).
 */
export async function dispatchNotification(
  organizationId: string,
  eventType: NotificationEventType,
  payload: NotificationPayload,
): Promise<{ sent: number }> {
  // Determine recipients
  let recipientIds = payload.recipientUserIds;

  if (!recipientIds || recipientIds.length === 0) {
    // Notify all members of the organization
    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    recipientIds = members.map((m) => m.userId);
  }

  if (recipientIds.length === 0) {
    logger.warn("No recipients for notification", { organizationId, eventType });
    return { sent: 0 };
  }

  // Fetch user details (email + name) in bulk
  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, email: true, name: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Pre-fetch Slack webhook URL once (premium channel)
  const slackWebhookUrl = await getSlackWebhookUrl(organizationId);

  let sentCount = 0;

  for (const userId of recipientIds) {
    const user = userMap.get(userId);
    if (!user) continue;

    const pref = await getOrCreatePreference(userId, organizationId, eventType);

    // In-app notification (core)
    if (pref.inAppEnabled) {
      try {
        await sendInApp(userId, organizationId, eventType, payload);
      } catch (err) {
        logger.error("Failed to create in-app notification", err, { userId });
      }
    }

    // Email notification (core)
    if (pref.emailEnabled) {
      await sendEmail(user.email, user.name, payload);
    }

    // Slack notification (premium — per-user preference + org webhook)
    if (pref.slackEnabled && slackWebhookUrl) {
      try {
        await sendSlackMessage(slackWebhookUrl, payload);
      } catch (err) {
        logger.error("Failed to send Slack notification", err, { userId });
      }
    }

    sentCount++;
  }

  return { sent: sentCount };
}
