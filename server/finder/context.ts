import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "./agent.js";

/**
 * Resolve an account's context brief for the finder.
 *
 * If a "Context — <Account>" Google Doc already exists (with real content), we
 * use it. If not, we read the account's OTHER documents (Docs + Sheets in its
 * folder), have Claude synthesize a context brief from them, save it as that
 * Doc, and use it. So an account with source material but no context doc gets
 * one built automatically the first time you run the finder.
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const DOC_MIME = "application/vnd.google-apps.document";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
export const CONTEXT_PREFIX = "Context —";

const MAX_MATERIAL_CHARS = 80000;
const MAX_PER_FILE_CHARS = 20000;
const MAX_FILES = 15;
/** Finder outputs — never feed these back in as "materials". */
const OUTPUT_SUFFIXES = ["— companies", "— contacts", "— targets"];

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}

async function driveGet(url: string, token: string): Promise<Response> {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function listFolder(token: string, driveId: string, folderId: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,webViewLink)",
    corpora: "drive",
    driveId,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    pageSize: "200",
    orderBy: "name",
  });
  const res = await driveGet(`${DRIVE}/files?${params.toString()}`, token);
  if (!res.ok) throw new Error(`Couldn't list the account folder (${res.status}).`);
  return ((await res.json()) as { files?: DriveFile[] }).files ?? [];
}

async function exportFile(token: string, fileId: string, mime: string): Promise<string> {
  const res = await driveGet(
    `${DRIVE}/files/${fileId}/export?mimeType=${encodeURIComponent(mime)}`,
    token,
  );
  return res.ok ? res.text() : "";
}

function isContextDoc(f: DriveFile): boolean {
  return f.mimeType === DOC_MIME && f.name.startsWith(CONTEXT_PREFIX);
}

function isFinderOutput(f: DriveFile): boolean {
  const n = f.name.toLowerCase();
  return OUTPUT_SUFFIXES.some((s) => n.endsWith(s));
}

/** Concatenate readable text from the account's Docs + Sheets (capped). */
async function readMaterials(token: string, files: DriveFile[]): Promise<string> {
  const readable = files
    .filter((f) => (f.mimeType === DOC_MIME || f.mimeType === SHEET_MIME) && !isContextDoc(f) && !isFinderOutput(f))
    .slice(0, MAX_FILES);

  let out = "";
  for (const f of readable) {
    if (out.length >= MAX_MATERIAL_CHARS) break;
    const mime = f.mimeType === DOC_MIME ? "text/plain" : "text/csv";
    const text = (await exportFile(token, f.id, mime)).slice(0, MAX_PER_FILE_CHARS).trim();
    if (text) out += `\n\n===== ${f.name} =====\n${text}`;
  }
  return out.slice(0, MAX_MATERIAL_CHARS).trim();
}

function contextSystemPrompt(): string {
  return [
    "You build account context briefs for lab2scale, a firm that takes deep-tech startups to market.",
    "Each 'account' is one of those startups. You'll be given the account's source materials (decks,",
    "notes, trackers, target lists). Synthesize them into a context brief that will drive outreach.",
    "",
    "Output ONLY HTML body content — no markdown, no <html>/<head>/<body> wrapper, no code fences.",
    "Use <h1> once for the title, <h2> for each section, and <p>/<ul><li> for content. Sections, in",
    "this order:",
    "  <h1>{Account} — account context</h1>",
    "  <h2>Strategy for finding contacts</h2>",
    "  <h2>Account background / overview</h2>",
    "  <h2>Ideal contact profile</h2>   (be specific about FUNCTIONS/titles to target, not just CEOs)",
    "  <h2>Outreach angle / positioning</h2>",
    "  <h2>Notes &amp; learnings</h2>",
    "",
    "Base everything strictly on the materials. Don't invent facts. Be concrete and useful.",
  ].join("\n");
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function generateContextHtml(
  apiKey: string,
  accountName: string,
  materials: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 6000,
    system: contextSystemPrompt(),
    messages: [
      {
        role: "user",
        content: `Account: ${accountName}\n\n--- Source materials ---${materials}\n--- End of materials ---\n\nSynthesize the account context brief now, as HTML.`,
      },
    ],
  });
  const message = await stream.finalMessage();
  const html = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return stripFences(html);
}

/** Create a "Context — <Account>" Google Doc from HTML (Drive converts it). */
async function createContextDoc(
  token: string,
  folderId: string,
  accountName: string,
  html: string,
): Promise<DriveFile> {
  const boundary = `l2s-ctx-${accountName.length}-${html.length}`;
  const metadata = {
    name: `${CONTEXT_PREFIX} ${accountName}`,
    mimeType: DOC_MIME,
    parents: [folderId],
  };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  const res = await fetch(
    `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Couldn't save the generated context doc (${res.status}).`);
  return res.json() as Promise<DriveFile>;
}

export interface ResolvedContext {
  text: string;
  /** True when we generated a new context doc from the account's materials. */
  created: boolean;
  docUrl?: string;
}

export async function resolveContext(opts: {
  token: string;
  apiKey: string;
  driveId: string;
  folderId: string;
  accountName: string;
}): Promise<ResolvedContext> {
  const { token, apiKey, driveId, folderId, accountName } = opts;
  const files = await listFolder(token, driveId, folderId);

  // Use an existing context doc if it has real content.
  const existing = files.find(isContextDoc);
  if (existing) {
    const text = (await exportFile(token, existing.id, "text/plain")).trim();
    if (text.length > 40) return { text, created: false, docUrl: existing.webViewLink };
  }

  // Otherwise, build one from the account's documents.
  const materials = await readMaterials(token, files);
  if (!materials) return { text: "", created: false };

  const html = await generateContextHtml(apiKey, accountName, materials);
  const doc = await createContextDoc(token, folderId, accountName, html);
  const text = (await exportFile(token, doc.id, "text/plain")).trim();
  return { text, created: true, docUrl: doc.webViewLink };
}
