import { mockExperts, specializations, type ExpertProfile } from "./mock-data";

const DEALROOM_API_URL = process.env.DEALROOM_API_URL;
const DEALROOM_API_KEY = process.env.DEALROOM_API_KEY;

const useMock = !DEALROOM_API_URL || !DEALROOM_API_KEY;

export interface ExpertSearchParams {
  query?: string;
  specialization?: string;
  country?: string;
  language?: string;
}

function filterMockExperts(params: ExpertSearchParams): ExpertProfile[] {
  let results = [...mockExperts];

  if (params.query) {
    const q = params.query.toLowerCase();
    results = results.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.firm.toLowerCase().includes(q) ||
        e.bio.toLowerCase().includes(q) ||
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
      (e) => e.location.country.toLowerCase() === params.country!.toLowerCase()
    );
  }

  if (params.language) {
    results = results.filter((e) =>
      e.languages.some(
        (l) => l.toLowerCase() === params.language!.toLowerCase()
      )
    );
  }

  return results;
}

export async function searchExperts(
  params: ExpertSearchParams
): Promise<ExpertProfile[]> {
  if (useMock) {
    return filterMockExperts(params);
  }

  const res = await fetch(`${DEALROOM_API_URL}/api/experts/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEALROOM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
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

  const res = await fetch(`${DEALROOM_API_URL}/api/experts/${id}`, {
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

export function getCountries(): string[] {
  return [...new Set(mockExperts.map((e) => e.location.country))].sort();
}

export function getLanguages(): string[] {
  return [...new Set(mockExperts.flatMap((e) => e.languages))].sort();
}
