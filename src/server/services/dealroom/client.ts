// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

import {
  directoryExperts,
  specializations,
  expertTypes,
  countryNames,
  languageNames,
  type ExpertProfile,
} from "./directory-data";
import { logger } from "@/lib/logger";

const RAW_DEALROOM_URL = process.env.DEALROOM_API_URL ?? "";
const DEALROOM_API_KEY = process.env.DEALROOM_API_KEY;

// Normalize: env var may include path prefix (e.g. ".../api/v1/experts") — strip to base domain
const DEALROOM_API_URL = RAW_DEALROOM_URL.replace(/\/api\/v1\/experts\/?$/, "").replace(/\/+$/, "");

// With no directory service configured, the local list in ./directory-data.ts
// is what a user sees. That list used to hold invented people, so production
// was made to show an empty directory instead. It now holds one real person
// and nothing else, so the local list is served everywhere, on every posture,
// including when the directory service is configured but fails. The old
// DEALROOM_MOCK_EXPERTS opt-in is gone: there is no fiction left to opt in to.
const unconfigured = !DEALROOM_API_URL || !DEALROOM_API_KEY;

export type { ExpertProfile };

// ---------------------------------------------------------------------------
// The contact address of a person in the directory is ours to hold, never
// ours to hand out (owner's decision, 2026-09-20). No user may see it, in a
// card, in a detail panel, in an export or in any API response, and no request
// is mailed to it from this product: every request goes to our own inbox and
// we contact the person ourselves.
//
// The address is therefore stripped at the boundary rather than at each call
// site: the exported read functions return PublicExpertProfile, which has no
// `email` field at all, so forgetting to strip it is a type error rather than
// a leak. getExpertRecord() is the single way to reach the full record, and is
// for our own storage only — see src/server/routers/privacy/experts.ts.
// ---------------------------------------------------------------------------
export type PublicExpertProfile = Omit<ExpertProfile, "email">;

function toPublicExpert(expert: ExpertProfile): PublicExpertProfile {
  const shown: PublicExpertProfile & { email?: string | null } = { ...expert };
  delete shown.email;
  return shown;
}

export interface ExpertSearchParams {
  query?: string;
  specialization?: string;
  country?: string; // ISO 3166-1 alpha-2
  language?: string; // ISO 639-1
  expertType?: "technical" | "deployment";
  excludeType?: string; // Exclude experts whose ONLY type matches (e.g. "deployment")
  limit?: number;
  offset?: number;
}

/** What a client receives: profiles with no contact address. */
export interface ExpertSearchResult {
  results: PublicExpertProfile[];
  total: number;
  offset: number;
}

/** What the directory holds internally, address included. */
interface DirectorySearchResult {
  results: ExpertProfile[];
  total: number;
  offset: number;
}

// Lawyer services are not offered through this platform (2026-07 decision), so
// the "legal" label is stripped from every profile before it is shown. It is a
// label strip only: since 2026-09-20 the allow-list below decides who appears,
// and a permitted person is never dropped for carrying that label.
const EXCLUDED_EXPERT_TYPE = "legal";

function stripLegalType(expert: ExpertProfile): ExpertProfile {
  const types = expert.expertTypes.filter(
    (t) => t.toLowerCase() !== EXCLUDED_EXPERT_TYPE
  );
  if (types.length === expert.expertTypes.length) return expert;
  return { ...expert, expertTypes: types };
}

// ---------------------------------------------------------------------------
// The allow-list. Exactly one person may appear in the directory of people
// available for technical help (owner's decision, 2026-09-20).
//
// This is enforced at the point the list is READ, not only in the local list,
// so a name added to the upstream directory — however plausible, however real
// — cannot reach a user here until it is added to this set on purpose. Match
// is on the name, case- and whitespace-insensitive, because the upstream id
// is not ours to rely on.
//
// Removing this filter, or widening it, needs the owner's decision. Do not
// widen it to make a test or a demo look better.
// ---------------------------------------------------------------------------
const PERMITTED_DIRECTORY_NAMES = new Set(["steve crowley"]);

function normalizeName(name: string | null): string {
  return (name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isPermittedExpert(expert: Pick<ExpertProfile, "name">): boolean {
  return PERMITTED_DIRECTORY_NAMES.has(normalizeName(expert.name));
}

/** The only gate that decides who a user sees. Applied to every source. */
function permittedOnly(experts: ExpertProfile[]): ExpertProfile[] {
  return experts.filter(isPermittedExpert).map(stripLegalType);
}

function filterLocalDirectory(params: ExpertSearchParams): DirectorySearchResult {
  let results = permittedOnly(directoryExperts);

  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(
      (e) =>
        (e.name?.toLowerCase().includes(q) ?? false) ||
        (e.firm?.toLowerCase().includes(q) ?? false) ||
        (e.bio?.toLowerCase().includes(q) ?? false) ||
        e.specializations.some((s) => s.toLowerCase().includes(q))
    );
  }

  if (params.specialization) {
    results = results.filter((e) =>
      e.specializations.some(
        (s) => s.toLowerCase() === params.specialization!.toLowerCase()
      )
    );
  }

  if (params.country) {
    results = results.filter(
      (e) =>
        e.location.country?.toLowerCase() === params.country!.toLowerCase()
    );
  }

  if (params.language) {
    results = results.filter((e) =>
      e.languages.some(
        (l) => l.toLowerCase() === params.language!.toLowerCase()
      )
    );
  }

  if (params.expertType) {
    results = results.filter((e) => e.expertTypes.includes(params.expertType!));
  }

  // Exclude experts whose only type matches excludeType (e.g. deployment-only)
  if (params.excludeType) {
    const exc = params.excludeType.toLowerCase();
    results = results.filter(
      (e) => !(e.expertTypes.length === 1 && e.expertTypes[0].toLowerCase() === exc)
    );
  }

  // Sort by profileCompleteness descending (best profiles first)
  results.sort((a, b) => b.profileCompleteness - a.profileCompleteness);

  const total = results.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  results = results.slice(offset, offset + limit);

  return { results, total, offset };
}

/** The directory as we hold it. Internal: the results carry the address. */
async function searchDirectory(
  params: ExpertSearchParams
): Promise<DirectorySearchResult> {
  if (unconfigured) {
    return filterLocalDirectory(params);
  }

  const res = await fetch(`${DEALROOM_API_URL}/api/v1/experts/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEALROOM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: params.query,
      specialization: params.specialization,
      country: params.country,
      language: params.language,
      expertType: params.expertType,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
    }),
    next: { revalidate: 300 }, // 5-minute cache
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    logger.error("Dealroom search failed", undefined, {
      status: res.status,
      url: `${DEALROOM_API_URL}/api/v1/experts/search`,
      error: errorBody.slice(0, 300),
    });
    // Degrade to the local list, which holds only permitted people.
    return filterLocalDirectory(params);
  }

  const data: DirectorySearchResult = await res.json();

  // The allow-list decides who a user sees, whatever the upstream returns.
  data.results = permittedOnly(data.results ?? []);

  // Client-side exclude filter (Dealroom API doesn't support excludeType)
  if (params.excludeType) {
    const exc = params.excludeType.toLowerCase();
    data.results = data.results.filter(
      (e) => !(e.expertTypes.length === 1 && e.expertTypes[0].toLowerCase() === exc)
    );
  }

  const offset = params.offset ?? 0;

  // The filter runs after the upstream has paged, so a permitted person sitting
  // on a later upstream page would leave the first page empty. On an empty
  // first page, serve the local list instead: the person must be listed, and
  // the local list is subject to the same allow-list.
  if (data.results.length === 0 && offset === 0) {
    return filterLocalDirectory(params);
  }

  // `total` counts what survives the filter, not the upstream directory:
  // reporting the upstream count would page the user into empty results.
  data.total = offset + data.results.length;
  data.offset = offset;
  return data;
}

/** The directory as a user sees it: every profile without its address. */
export async function searchExperts(
  params: ExpertSearchParams
): Promise<ExpertSearchResult> {
  const found = await searchDirectory(params);
  return { ...found, results: found.results.map(toPublicExpert) };
}

/**
 * The full record, address included. For our own use only: storing it on an
 * engagement row so we can contact the person ourselves. Never return the
 * value of this function to a client — use getExpertById for that.
 */
export async function getExpertRecord(
  id: string
): Promise<ExpertProfile | null> {
  const findLocal = () =>
    permittedOnly(directoryExperts).find((e) => e.id === id) ?? null;

  if (unconfigured) {
    return findLocal();
  }

  const res = await fetch(`${DEALROOM_API_URL}/api/v1/experts/${id}`, {
    headers: {
      Authorization: `Bearer ${DEALROOM_API_KEY}`,
    },
    next: { revalidate: 3600 }, // 1-hour cache
  });

  if (!res.ok) {
    return findLocal();
  }

  const expert: ExpertProfile = await res.json();
  // Same gate as the list: an id that resolves upstream to a person who is not
  // on the allow-list must not resolve to a profile here either.
  return isPermittedExpert(expert) ? stripLegalType(expert) : findLocal();
}

/** One person as a user sees them: the profile without its address. */
export async function getExpertById(
  id: string
): Promise<PublicExpertProfile | null> {
  const expert = await getExpertRecord(id);
  return expert ? toPublicExpert(expert) : null;
}

export function getSpecializations(): string[] {
  return specializations;
}

export function getCountries(): { code: string; name: string }[] {
  if (unconfigured) {
    // Offer only the countries the local list can actually match on.
    const codes = [
      ...new Set(
        permittedOnly(directoryExperts)
          .map((e) => e.location.country)
          .filter((c): c is string => c != null)
      ),
    ].sort();
    return codes.map((code) => ({
      code,
      name: countryNames[code] ?? code,
    }));
  }
  // When using real API, return all known countries
  return Object.entries(countryNames)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getLanguages(): { code: string; name: string }[] {
  if (unconfigured) {
    const codes = [
      ...new Set(permittedOnly(directoryExperts).flatMap((e) => e.languages)),
    ].sort();
    return codes.map((code) => ({
      code,
      name: languageNames[code] ?? code,
    }));
  }
  return Object.entries(languageNames)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getExpertTypes() {
  return expertTypes;
}

export interface ContactExpertParams {
  expertId: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompany?: string;
  subject: string;
  message?: string;
  governingLaw?: string;
}

export interface ContactExpertResult {
  requestId: string;
  status: string;
  createdAt: string;
}

export async function contactExpert(
  params: ContactExpertParams
): Promise<ContactExpertResult> {
  if (unconfigured) {
    // With no directory service, the request is handled here: the caller
    // (src/server/routers/privacy/experts.ts) records it and copies it to our
    // own inbox, so it does reach a human. Returning a local id rather than
    // throwing is honest for that reason, and only for that reason — if the
    // inbox copy is ever removed, this must go back to throwing.
    if (!permittedOnly(directoryExperts).some((e) => e.id === params.expertId)) {
      logger.warn("Contact request for an unknown directory entry", {
        expertId: params.expertId,
      });
    }
    return {
      requestId: `req-local-${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  const { expertId, ...body } = params;

  let res: Response;
  try {
    res = await fetch(
      `${DEALROOM_API_URL}/api/v1/experts/${expertId}/contact`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEALROOM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    logger.error("Dealroom contact request network error", err);
    // Fall back to mock response so the user isn't blocked
    return {
      requestId: `req-fallback-${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("Dealroom contact request failed", undefined, { status: res.status, body: text.slice(0, 200) });
    // Fall back to mock response rather than throwing
    return {
      requestId: `req-fallback-${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  return res.json();
}

export interface ContactRequestResult {
  requestId: string;
  expertId: string;
  expertName: string;
  subject: string;
  status: string;
  message: string | null;
  requesterName: string;
  requesterEmail: string;
  requesterCompany: string | null;
  governingLaw: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export async function getContactRequest(
  requestId: string
): Promise<ContactRequestResult | null> {
  // Locally handled requests have no upstream record to look up.
  if (unconfigured) {
    return null;
  }

  const res = await fetch(
    `${DEALROOM_API_URL}/api/v1/experts/requests/${requestId}`,
    {
      headers: {
        Authorization: `Bearer ${DEALROOM_API_KEY}`,
      },
    }
  );

  if (!res.ok) {
    return null;
  }

  return res.json();
}
