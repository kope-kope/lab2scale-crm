import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleFindContacts } from "../server/finder/handle.js";

/** Give web search room to run; the finder is one slow request, not many. */
export const config = { maxDuration: 60 };

/**
 * Vercel serverless surface for the AI contact finder. Holds ANTHROPIC_API_KEY
 * server-side — it never reaches the browser. All logic lives in the shared
 * handler so this file is just the HTTP adapter.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  const { status, body } = await handleFindContacts({
    authHeader: req.headers.authorization,
    body: req.body,
  });
  res.status(status).json(body);
}
