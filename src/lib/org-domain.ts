// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * The organisation domain claim (cycle 12, F1).
 *
 * An organisation's `domain` drives the sign-in auto-join, so it is a claim
 * of ownership and is accepted from nobody's word. ONE rule, used on create,
 * on update and again at every auto-join:
 *
 *   an organisation may carry a domain only if it equals the domain of its
 *   OWNER's own proven sign-in address and is not a public mail provider.
 *
 * Anything else is stored as "no domain" (never a refusal), and the auto-join
 * joins nobody. Fails closed: no owner, no proven address, two organisations
 * storing one domain: no domain, no join.
 */

import type { Db } from "./prisma";
import { features } from "@/config/features";
import { isHostedDeployment } from "@/lib/hosted";
import { getSecurityModule } from "@/lib/security";

/**
 * Public mail providers. Part of the open-source core so the rule holds on
 * every build; the optional security package may add to it, never replace it.
 */
export const PUBLIC_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.es", "hotmail.com",
  "hotmail.es", "hotmail.co.uk", "hotmail.fr", "hotmail.it", "hotmail.de",
  "live.com", "live.co.uk", "live.fr", "msn.com", "passport.com",
  "yahoo.com", "yahoo.es", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.it",
  "yahoo.com.mx", "yahoo.com.br", "yahoo.com.ar", "yahoo.co.jp", "yahoo.ca",
  "ymail.com", "rocketmail.com", "aol.com", "aim.com",
  "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "protonmail.ch", "pm.me",
  "tutanota.com", "tutanota.de", "tuta.io", "tuta.com", "tutamail.com",
  "gmx.com", "gmx.net", "gmx.de", "gmx.at", "gmx.ch", "gmx.es", "gmx.fr",
  "web.de", "t-online.de", "freenet.de", "mail.com", "email.com",
  "zoho.com", "zohomail.com", "zohomail.eu",
  "yandex.com", "yandex.ru", "mail.ru", "inbox.ru", "list.ru", "bk.ru", "rambler.ru",
  "fastmail.com", "fastmail.fm", "hey.com", "hushmail.com", "mailbox.org",
  "posteo.de", "posteo.net", "runbox.com", "startmail.com", "duck.com",
  "qq.com", "163.com", "126.com", "sina.com", "sina.cn", "foxmail.com", "naver.com", "daum.net",
  "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr",
  "libero.it", "virgilio.it", "tiscali.it", "alice.it",
  "telefonica.net", "terra.com", "terra.es", "movistar.es",
  "btinternet.com", "sky.com", "virginmedia.com", "talktalk.net", "ntlworld.com",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net",
  "cox.net", "charter.net", "earthlink.net", "shaw.ca", "rogers.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "prodigy.net.mx",
  "rediffmail.com", "seznam.cz", "wp.pl", "o2.pl", "interia.pl", "onet.pl",
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "yopmail.com", "sharklasers.com", "trashmail.com",
]);

/** The lower-cased domain of an address, or null when there is none. */
export function emailDomainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

export function isPublicEmailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (PUBLIC_EMAIL_DOMAINS.has(d)) return true;
  return getSecurityModule()?.isPublicEmailDomain?.(d) === true;
}

/**
 * The domain an organisation may carry, given what was asked for and its
 * owner's proven address: the asked-for domain (lower-cased) when the rule
 * holds, null in every other case.
 */
export function permittedOrgDomain(
  requested: string | null | undefined,
  ownerProvenEmail: string | null
): string | null {
  const asked = requested?.trim().toLowerCase();
  if (!asked) return null;
  const own = emailDomainOf(ownerProvenEmail);
  if (!own || asked !== own || isPublicEmailDomain(asked)) return null;
  return asked;
}

/**
 * The address this product itself has seen proven for a user, or null.
 * Proven means: a magic link was followed (emailVerified) or a Google account
 * is linked. A row minted from a sibling's token (JIT) has neither. On the
 * self-host local-login posture no address is ever proven by design (the firm
 * trusts its own network), so the stored address stands there, never on hosted.
 */
export async function provenEmailOf(
  prisma: Pick<Db, "user">,
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      accounts: { where: { provider: "google" }, select: { id: true }, take: 1 },
    },
  });
  if (!user?.email) return null;
  if (user.emailVerified || (user.accounts?.length ?? 0) > 0) return user.email;
  if (features.devAuthEnabled && !isHostedDeployment()) return user.email;
  return null;
}

/** The proven address of the organisation's oldest OWNER, or null. */
export async function ownerProvenEmailOf(
  prisma: Pick<Db, "user" | "organizationMember">,
  organizationId: string
): Promise<string | null> {
  const owner = await prisma.organizationMember.findFirst({
    where: { organizationId, role: "OWNER" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: { userId: true },
  });
  if (!owner) return null;
  return provenEmailOf(prisma, owner.userId);
}

/**
 * The one organisation a new sign-in from this address may be joined to, or
 * null. Never joins where more than one organisation stores the domain, and
 * re-checks the stored domain against the owner's address as it is today.
 */
export async function findAutoJoinOrganization(
  prisma: Pick<Db, "user" | "organizationMember" | "organization">,
  email: string | null | undefined
): Promise<{ id: string } | null> {
  const domain = emailDomainOf(email);
  if (!domain || isPublicEmailDomain(domain)) return null;

  const claimants = await prisma.organization.findMany({
    where: { domain: { equals: domain, mode: "insensitive" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, domain: true },
    take: 2,
  });
  if (claimants.length !== 1) return null;

  const org = claimants[0];
  const ownerEmail = await ownerProvenEmailOf(prisma, org.id);
  if (!permittedOrgDomain(org.domain, ownerEmail)) return null;
  return { id: org.id };
}
