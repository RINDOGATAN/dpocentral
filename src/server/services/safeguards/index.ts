// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The safeguards question of the first-visit welcome card (hosted service
 * only; owner's decisions O1 to O3, 9 October 2026).
 *
 *   Who sees the card: the person who created the organisation on the hosted
 *   service, once, on the first visit to /privacy, before the quick start.
 *   Colleagues invited later never see it, and the kit never shows it.
 *   "Decide later" closes it and counts as option a.
 *
 *   What an answer does: a and "later" only record the choice. b (a fully
 *   managed virtual server) and c (the organisation's own hardware) can send
 *   a short request, which is stored and mailed to the tech firm's sales
 *   inbox. Nobody else is contacted: the hosting partner joins only after the
 *   first conversation and with the visitor's agreement.
 *
 *   How long a request is kept: until it is closed, then one year. The daily
 *   purge (/api/cron/safeguards-requests-purge) deletes it after that. No
 *   marketing list, no other use.
 */

import type { SafeguardsChoice } from "@prisma/client";
import { isHostedDeployment } from "@/lib/hosted";
import { brand } from "@/config/brand";
import {
  internalInboxAddresses,
  sendInternalNotice,
  type InternalNoticeResult,
} from "@/server/services/notifications/internal-inbox";

/** The choices that ask for a conversation with the tech firm. */
export const REQUEST_CHOICES = ["managed", "own_hardware"] as const;
export type RequestChoice = (typeof REQUEST_CHOICES)[number];

/** Approximate number of people who would use the product. */
export const USER_COUNT_BANDS = ["1-5", "6-25", "26+"] as const;

/** A request is kept this long after it is closed. */
export const CLOSED_REQUEST_RETENTION_DAYS = 365;

/** Open requests an organisation may hold at once (a guard against repeats). */
export const MAX_OPEN_REQUESTS_PER_ORG = 3;

export function isRequestChoice(choice: SafeguardsChoice | string): choice is RequestChoice {
  return (REQUEST_CHOICES as readonly string[]).includes(choice);
}

function addressList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

/**
 * The tech firm's sales inbox: SALES_INBOX_EMAIL (comma-separated), else the
 * inbox the operator already reads (CONTACT_EMAIL, then ADMIN_EMAILS, then the
 * standing company address; see internal-inbox.ts), so a request is never
 * addressed to nobody.
 */
export function salesInboxAddresses(
  env: Record<string, string | undefined> = process.env
): string[] {
  const sales = addressList(env.SALES_INBOX_EMAIL);
  return sales.length > 0 ? sales : internalInboxAddresses();
}

/**
 * Whether the welcome card is shown to this person in this organisation:
 * hosted service only, to the person recorded as its creator, and only while
 * the question is unanswered.
 */
export function shouldShowWelcome(
  org: { welcomeUserId: string | null; safeguardsChoice: SafeguardsChoice | null },
  userId: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!isHostedDeployment(env)) return false;
  if (!org.welcomeUserId || org.welcomeUserId !== userId) return false;
  return org.safeguardsChoice === null;
}

const CHOICE_LABELS: Record<RequestChoice, string> = {
  managed: "b) A fully managed virtual server for them alone",
  own_hardware: "c) On their own hardware, with local AI models",
};

export interface SafeguardsRequestInput {
  id: string;
  organizationId: string;
  choice: RequestChoice;
  name: string;
  email: string;
  organizationName: string;
  country: string;
  userCount: string;
  message: string | null;
  locale: string;
  createdAt: Date;
}

/**
 * The one notification e-mail to the sales inbox: the fields of the request
 * and nothing more. The subject carries no user value; answering it answers
 * the person.
 */
export function sendSafeguardsRequestNotice(
  request: SafeguardsRequestInput
): Promise<InternalNoticeResult> {
  return sendInternalNotice({
    to: salesInboxAddresses(),
    subject: `${brand.name}: request to run it on a managed server or own hardware`,
    intro:
      "Someone answered the safeguards question on the hosted service and asked us to write to them. Use these details only to answer this request. Do not pass them to the hosting partner without the person's agreement.",
    replyTo: request.email,
    fields: [
      { label: "Choice", value: CHOICE_LABELS[request.choice] },
      { label: "Name", value: request.name },
      { label: "Work e-mail", value: request.email },
      { label: "Organisation", value: request.organizationName },
      { label: "Country", value: request.country },
      { label: "People who would use it", value: request.userCount },
      { label: "Language", value: request.locale },
      { label: "Product", value: brand.name },
      { label: "When", value: request.createdAt.toISOString() },
      { label: "Request id", value: request.id },
    ],
    body: request.message,
    record: {
      safeguardsRequestId: request.id,
      organizationId: request.organizationId,
    },
  });
}

/** The latest closedAt a request may have and still be kept. */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - CLOSED_REQUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

interface PurgePrisma {
  safeguardsRequest: {
    deleteMany: (args: {
      where: { status: "closed"; closedAt: { lt: Date } };
    }) => Promise<{ count: number }>;
  };
}

/**
 * Delete every request closed more than one year ago. Open requests, and
 * closed ones within the year, are never touched.
 */
export async function purgeClosedSafeguardsRequests(
  prisma: PurgePrisma,
  now: Date = new Date()
): Promise<{ deleted: number; cutoff: string }> {
  const cutoff = purgeCutoff(now);
  const result = await prisma.safeguardsRequest.deleteMany({
    where: { status: "closed", closedAt: { lt: cutoff } },
  });
  return { deleted: result.count, cutoff: cutoff.toISOString() };
}
