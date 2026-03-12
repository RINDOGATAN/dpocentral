import {
  mockExperts,
  specializations,
  expertTypes,
  countryNames,
  languageNames,
  type ExpertProfile,
} from "./mock-data";

const DEALROOM_API_URL = process.env.DEALROOM_API_URL;
const DEALROOM_API_KEY = process.env.DEALROOM_API_KEY;

const useMock = !DEALROOM_API_URL || !DEALROOM_API_KEY;

export type { ExpertProfile };

export interface ExpertSearchParams {
  query?: string;
  specialization?: string;
  country?: string; // ISO 3166-1 alpha-2
  language?: string; // ISO 639-1
  expertType?: "legal" | "technical" | "deployment";
  limit?: number;
  offset?: number;
}

export interface ExpertSearchResult {
  results: ExpertProfile[];
  total: number;
  offset: number;
}

function filterMockExperts(params: ExpertSearchParams): ExpertSearchResult {
  let results = [...mockExperts];

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

  // Sort by profileCompleteness descending (best profiles first)
  results.sort((a, b) => b.profileCompleteness - a.profileCompleteness);

  const total = results.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  results = results.slice(offset, offset + limit);

  return { results, total, offset };
}

export async function searchExperts(
  params: ExpertSearchParams
): Promise<ExpertSearchResult> {
  if (useMock) {
    return filterMockExperts(params);
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
    console.error("Dealroom search failed:", res.status);
    return filterMockExperts(params); // Fallback to mock
  }

  return res.json();
}

export async function getExpertById(
  id: string
): Promise<ExpertProfile | null> {
  if (useMock) {
    return mockExperts.find((e) => e.id === id) ?? null;
  }

  const res = await fetch(`${DEALROOM_API_URL}/api/v1/experts/${id}`, {
    headers: {
      Authorization: `Bearer ${DEALROOM_API_KEY}`,
    },
    next: { revalidate: 3600 }, // 1-hour cache
  });

  if (!res.ok) {
    return mockExperts.find((e) => e.id === id) ?? null;
  }

  return res.json();
}

export function getSpecializations(): string[] {
  return specializations;
}

export function getCountries(): { code: string; name: string }[] {
  if (useMock) {
    const codes = [
      ...new Set(
        mockExperts
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
  if (useMock) {
    const codes = [
      ...new Set(mockExperts.flatMap((e) => e.languages)),
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
  if (useMock) {
    return {
      requestId: `req-mock-${Date.now()}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  }

  const { expertId, ...body } = params;
  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Contact request failed (${res.status}): ${text}`);
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
  if (useMock) {
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
