import Anthropic from "@anthropic-ai/sdk";
import {
  findLeadsSheet,
  readLeadGrid,
  findOrCreateRulesDoc,
  writeVerdicts,
  resolveDataRow,
  firstSheetGid,
  deleteRow,
} from "./leadsSheet.js";
import { screenLead, formatScreen, type LeadInput, type Screen } from "./screen.js";

/**
 * Qualify leads by running the Lab2Scale Deal Screen on each and writing the
 * verdict (Pursue / Gate / Pass) to the Status column and the full screen to the
 * Screen column. Synchronous: one focused AI call per lead, no web search.
 */

interface Counts {
  total: number;
  pursue: number;
  gate: number;
  pass: number;
}

export interface QualifyResponse {
  status: number;
  body:
    | (Counts & { sheetUrl: string; rulesUrl: string; rulesCreated: boolean })
    | { error: string };
}

function countVerdicts(screens: Screen[]): Counts {
  return {
    total: screens.length,
    pursue: screens.filter((s) => s.verdict === "Pursue").length,
    gate: screens.filter((s) => s.verdict === "Gate").length,
    pass: screens.filter((s) => s.verdict === "Pass").length,
  };
}

/** Turn screens into the sheet-writeback shape (Status ← verdict, note ← screen). */
function toRows(screens: Screen[], indexOf: (s: Screen) => number) {
  return screens.map((s) => ({
    index: indexOf(s),
    company: s.company,
    decision: s.verdict,
    reason: formatScreen(s),
  }));
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

    // Screen each lead individually (a deal screen is a per-deal judgment).
    const screens: Screen[] = [];
    for (const lead of leads) {
      try {
        const s = await screenLead(apiKey, rules.text, lead);
        screens.push({ ...s, company: lead.company });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[leads] screen for "${lead.company}" failed:`, e);
      }
    }
    const byCompany = new Map(leads.map((l) => [l.company, l.index] as const));
    await writeVerdicts(token, sheet.sheetId, grid, toRows(screens, (s) => byCompany.get(s.company) ?? 0));

    return {
      status: 200,
      body: { ...countVerdicts(screens), sheetUrl: sheet.sheetUrl, rulesUrl: rules.url, rulesCreated: rules.created },
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

// ── Row-level actions ──────────────────────────────────────────────────────

interface RowRequest {
  driveId: string;
  company: string;
  rowIndex: number;
}

function parseRow(req: QualifyRequest): { token: string; row: RowRequest } | { error: QualifyResponse } {
  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: { status: 401, body: { error: "Missing sign-in token." } } };
  const body = (req.body ?? {}) as { driveId?: unknown; company?: unknown; rowIndex?: unknown };
  const driveId = typeof body.driveId === "string" ? body.driveId.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const rowIndex = typeof body.rowIndex === "number" ? body.rowIndex : -1;
  if (!driveId) return { error: { status: 400, body: { error: "Missing drive id." } } };
  if (!company) return { error: { status: 400, body: { error: "Missing company." } } };
  return { token, row: { driveId, company, rowIndex } };
}

function mapError(err: unknown): QualifyResponse {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  if (err instanceof Anthropic.APIError) {
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 502;
    return { status, body: { error: `The AI request failed (${err.status ?? "?"}). ${err.message}` } };
  }
  if (err instanceof Error) return { status: 502, body: { error: err.message } };
  return { status: 500, body: { error: "Something went wrong." } };
}

/** Qualify a single lead (so obviously-bad ones needn't cost a full-sheet run). */
export async function handleQualifyLead(req: QualifyRequest): Promise<QualifyResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { status: 500, body: { error: "AI isn't configured yet — set ANTHROPIC_API_KEY on the server." } };
  const parsed = parseRow(req);
  if ("error" in parsed) return parsed.error;
  const { token, row } = parsed;

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());
    const sheet = await findLeadsSheet(token, row.driveId, row.driveId);
    const grid = await readLeadGrid(token, sheet.sheetId);
    const di = resolveDataRow(grid, row.company, row.rowIndex);
    if (di < 0) return { status: 404, body: { error: "That lead isn't in the sheet anymore — reload." } };

    const rules = await findOrCreateRulesDoc(token, row.driveId, sheet.folderId);
    const cell = (i: number) => (i >= 0 ? (grid.rows[di][i] ?? "").trim() : "");
    const idx = (names: string[]) => headerIdx(grid.headers, names);
    const lead: LeadInput = {
      index: di,
      company: row.company,
      sector: cell(idx(["sector", "category"])) || undefined,
      stage: cell(idx(["stage", "trl"])) || undefined,
      whyItFits: cell(idx(["why it fits", "why fits", "why", "rationale"])) || undefined,
      relevance: cell(idx(["relevance", "score"])) || undefined,
    };
    const screen = await screenLead(apiKey, rules.text, lead);
    await writeVerdicts(token, sheet.sheetId, grid, toRows([screen], () => di));
    return {
      status: 200,
      body: { ...countVerdicts([screen]), sheetUrl: sheet.sheetUrl, rulesUrl: rules.url, rulesCreated: rules.created },
    };
  } catch (err) {
    return mapError(err);
  }
}

export interface DeleteResponse {
  status: number;
  body: { deleted: true; company: string } | { error: string };
}

/** Delete a lead row from the sheet (destructive — the client confirms first). */
export async function handleDeleteLead(req: QualifyRequest): Promise<DeleteResponse> {
  const parsed = parseRow(req);
  if ("error" in parsed) return { status: parsed.error.status, body: parsed.error.body as { error: string } };
  const { token, row } = parsed;

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());
    const sheet = await findLeadsSheet(token, row.driveId, row.driveId);
    const grid = await readLeadGrid(token, sheet.sheetId);
    const di = resolveDataRow(grid, row.company, row.rowIndex);
    if (di < 0) return { status: 404, body: { error: "That lead isn't in the sheet anymore — reload." } };
    const gid = await firstSheetGid(token, sheet.sheetId);
    await deleteRow(token, sheet.sheetId, gid, di);
    return { status: 200, body: { deleted: true, company: row.company } };
  } catch (err) {
    const mapped = mapError(err);
    return { status: mapped.status, body: mapped.body as { error: string } };
  }
}
