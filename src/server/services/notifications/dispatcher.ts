import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Slack-only dispatcher
//
// The full notification cron (email + in-app + Slack on a daily schedule) was
// removed. This module now provides only the Slack webhook helper used by the
// "Test Slack webhook" admin action; reinstating cron-driven notifications
// will require restoring dispatchNotification + the email/in-app paths.
// ---------------------------------------------------------------------------

interface SlackPayload {
  title: string;
  message: string;
  link?: string;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
}

export async function sendSlackMessage(webhookUrl: string, payload: SlackPayload) {
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${payload.title}*\n${payload.message}` },
    },
  ];

  if (payload.link) {
    const baseUrl = process.env.NEXTAUTH_URL || "https://dpocentral.todo.law";
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
