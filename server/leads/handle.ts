import Anthropic from "@anthropic-ai/sdk";
import { findLeadsSheet, readLeadGrid, findOrCreateRulesDoc, writeVerdicts } from "./leadsSheet.js";
import { qualifyLeads, type LeadInput } from "./qualifyLeads.js";

/**
 * Qualify all leads in one pass and write the verdicts back to the Leads sheet.
 * Synchronous: it's a single AI call over the rules (no web search), so it
 * returns the summary directly rather than running in the background.
 */

export interface QualifyResponse {
  status: number;
  body:
    | { total: number; qualified: number; disqualified: number; sheetUrl: string; rulesUrl: string; rulesCreated: boolean }
    | { error: string };
}

const DEFAULT_DOMAIN = "lab-2-scale.com";

interface GoogleUserInfo {
  hd?: string;
  email?: string;
  email_verified?: boolean | string;
}

async function verifyGoogleDomain(accessToken: string, allowedDomain: string): Promise<void> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(401, "Your Google session expired — sign in again.");
  const info = (await res.json()) as GoogleUserInfo;
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.hd !== allowedDomain || !verified) {
    const who = info.email || "This account";
    const seen = info.hd ? `a "${info.hd}" account` : "a personal account (no Workspace domain)";
    throw new HttpError(
      403,
      `${who} is ${seen}, but this server only allows "${allowedDomain}". ` +
        `If that's wrong, fix ALLOWED_DOMAIN on the server (Railway).`,
    );
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface QualifyRequest {
  authHeader?: string;
  body: unknown;
}

function headerIdx(headers: string[], names: string[]): number {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return headers.findIndex((h) => wanted.has(h.trim().toLowerCase()));
}

export async function handleQualifyLeads(req: QualifyRequest): Promise<QualifyResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { status: 500, body: { error: "AI isn't configured yet — set ANTHROPIC_API_KEY on the server." } };

  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { status: 401, body: { error: "Missing sign-in token." } };

  const body = (req.body ?? {}) as { driveId?: unknown };
  const driveId = typeof body.driveId === "string" ? body.driveId.trim() : "";
  if (!driveId) return { status: 400, body: { error: "Missing drive id." } };

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());

    const sheet = await findLeadsSheet(token, driveId, driveId);
    const grid = await readLeadGrid(token, sheet.sheetId);
    if (grid.rows.length === 0) {
      return { status: 400, body: { error: "No leads to qualify — the Leads sheet is empty." } };
    }

    const rules = await findOrCreateRulesDoc(token, driveId, sheet.folderId);

    const ci = headerIdx(grid.headers, ["company", "name"]);
    const si = headerIdx(grid.headers, ["sector", "category"]);
    const sti = headerIdx(grid.headers, ["stage", "trl"]);
    const wi = headerIdx(grid.headers, ["why it fits", "why fits", "why", "rationale"]);
    const ri = headerIdx(grid.headers, ["relevance", "score"]);
    const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const leads: LeadInput[] = grid.rows
      .map((row, index) => ({
        index,
        company: cell(row, ci),
        sector: cell(row, si) || undefined,
        stage: cell(row, sti) || undefined,
        whyItFits: cell(row, wi) || undefined,
        relevance: cell(row, ri) || undefined,
      }))
      .filter((l) => l.company);

    const verdicts = await qualifyLeads(apiKey, rules.text, leads);
    await writeVerdicts(token, sheet.sheetId, grid, verdicts);

    const qualified = verdicts.filter((v) => v.decision === "Qualified").length;
    return {
      status: 200,
      body: {
        total: verdicts.length,
        qualified,
        disqualified: verdicts.length - qualified,
        sheetUrl: sheet.sheetUrl,
        rulesUrl: rules.url,
        rulesCreated: rules.created,
      },
    };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    if (err instanceof Anthropic.APIError) {
      const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 502;
      return { status, body: { error: `The AI request failed (${err.status ?? "?"}). ${err.message}` } };
    }
    if (err instanceof Error) return { status: 502, body: { error: `Couldn't qualify leads. ${err.message}` } };
    return { status: 500, body: { error: "Something went wrong qualifying leads." } };
  }
}
