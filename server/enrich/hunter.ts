/**
 * Central Hunter.io client (LAB-34).
 *
 * One typed, server-side wrapper over the Hunter v2 API that any part of the app
 * can use to find and verify email addresses. The API key lives ONLY on the
 * server (HUNTER_API_KEY) — it must never reach the browser.
 *
 * Covers the three endpoints we need:
 *   - emailFinder   — a company + a person's name → their most likely email
 *   - emailVerifier — an email → deliverability status + confidence score
 *   - domainSearch  — a company/domain → the people & emails Hunter knows there
 *
 * Docs: https://hunter.io/api-documentation/v2
 */

const BASE = "https://api.hunter.io/v2";

export class HunterError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HunterError";
  }
}

/** True when a Hunter key is configured — callers can degrade gracefully. */
export function hunterConfigured(): boolean {
  return Boolean(process.env.HUNTER_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.HUNTER_API_KEY?.trim();
  if (!key) {
    throw new HunterError(500, "Email enrichment isn't configured — set HUNTER_API_KEY on the server (Railway).");
  }
  return key;
}

interface HunterErrorBody {
  errors?: { id?: string; code?: number; details?: string }[];
}

/** GET a Hunter endpoint, folding Hunter's error envelope into a HunterError. */
async function get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) qs.set(k, v.trim());
  }
  qs.set("api_key", apiKey());

  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}?${qs.toString()}`);
  } catch {
    throw new HunterError(502, "Couldn't reach Hunter.io. Try again in a moment.");
  }

  const json = (await res.json().catch(() => ({}))) as { data?: T } & HunterErrorBody;
  if (!res.ok) {
    const detail = json.errors?.map((e) => e.details).filter(Boolean).join("; ");
    // 401 = bad key, 429 = rate/quota — surface Hunter's own message when present.
    throw new HunterError(res.status, detail || `Hunter request failed (${res.status}).`);
  }
  return json.data as T;
}

// ── Email Finder ─────────────────────────────────────────────────────────────

export interface FoundEmail {
  /** The best-guess email, or null when Hunter couldn't find one. */
  email: string | null;
  /** Hunter's confidence, 0–100. */
  score: number | null;
  /** "generic" (info@) vs "personal", when known. */
  type?: string | null;
  position?: string | null;
  /** How verifiable the address is right now (Hunter's verification block). */
  verificationStatus?: string | null;
}

interface FinderRaw {
  email: string | null;
  score: number | null;
  position?: string | null;
  email_type?: string | null;
  verification?: { status?: string | null } | null;
}

/**
 * Find one person's email. Accepts a domain OR a company name (Hunter resolves
 * the domain), plus the person's full name. Returns email: null when not found
 * rather than throwing — "not found" is a normal result, not an error.
 */
export async function emailFinder(input: {
  fullName: string;
  domain?: string;
  company?: string;
}): Promise<FoundEmail> {
  if (!input.domain && !input.company) {
    throw new HunterError(400, "emailFinder needs a domain or a company name.");
  }
  const raw = await get<FinderRaw>("email-finder", {
    domain: input.domain,
    company: input.company,
    full_name: input.fullName,
  });
  return {
    email: raw.email ?? null,
    score: raw.score ?? null,
    type: raw.email_type ?? null,
    position: raw.position ?? null,
    verificationStatus: raw.verification?.status ?? null,
  };
}

// ── Email Verifier ───────────────────────────────────────────────────────────

export interface VerifiedEmail {
  /** deliverable | undeliverable | risky | unknown */
  result: string | null;
  status: string | null;
  score: number | null;
}

interface VerifierRaw {
  result?: string | null;
  status?: string | null;
  score?: number | null;
}

/** Verify a single email's deliverability. */
export async function emailVerifier(email: string): Promise<VerifiedEmail> {
  const raw = await get<VerifierRaw>("email-verifier", { email });
  return { result: raw.result ?? null, status: raw.status ?? null, score: raw.score ?? null };
}

// ── Domain Search ────────────────────────────────────────────────────────────

export interface DomainPerson {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  confidence?: number | null;
}

export interface DomainResult {
  domain: string | null;
  organization: string | null;
  people: DomainPerson[];
}

interface DomainRaw {
  domain?: string | null;
  organization?: string | null;
  emails?: {
    value: string;
    first_name?: string | null;
    last_name?: string | null;
    position?: string | null;
    confidence?: number | null;
  }[];
}

/**
 * Discover the people & emails Hunter knows at a company. Accepts a domain OR a
 * company name. `limit` caps results (Hunter default is 10).
 */
export async function domainSearch(input: {
  domain?: string;
  company?: string;
  limit?: number;
}): Promise<DomainResult> {
  if (!input.domain && !input.company) {
    throw new HunterError(400, "domainSearch needs a domain or a company name.");
  }
  const raw = await get<DomainRaw>("domain-search", {
    domain: input.domain,
    company: input.company,
    limit: input.limit ? String(input.limit) : undefined,
  });
  return {
    domain: raw.domain ?? null,
    organization: raw.organization ?? null,
    people: (raw.emails ?? []).map((e) => ({
      email: e.value,
      firstName: e.first_name ?? null,
      lastName: e.last_name ?? null,
      position: e.position ?? null,
      confidence: e.confidence ?? null,
    })),
  };
}
