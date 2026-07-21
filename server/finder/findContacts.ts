import Anthropic from "@anthropic-ai/sdk";
import { runResearchAgent } from "./agent.js";
import { contactsSystemPrompt, contactsUserPrompt } from "./prompts.js";

/** Stage 2: find real PEOPLE at the approved target companies. */

export interface FoundContact {
  /** Full name of the person. */
  name: string;
  /** Their role / job title. */
  title: string;
  /** The company they work at (one of the approved companies). */
  company: string;
  /** Work email, if one was found. */
  email?: string;
  /** LinkedIn profile URL, if one was found. */
  linkedin?: string;
  /** One line: why this person fits, grounded in the account context. */
  rationale: string;
}

const SUBMIT_CONTACTS: Anthropic.Tool = {
  name: "submit_contacts",
  description:
    "Submit the real, verified contacts you found at the approved companies. Call this exactly once, at the end.",
  input_schema: {
    type: "object",
    properties: {
      contacts: {
        type: "array",
        description: "The people you found. Omit anyone you can't verify is real.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Full name" },
            title: { type: "string", description: "Job title or role" },
            company: { type: "string", description: "The approved company they work at" },
            email: {
              type: "string",
              description: "Work email if you found a real one; otherwise leave empty. Never guess.",
            },
            linkedin: { type: "string", description: "LinkedIn profile URL if found; otherwise empty." },
            rationale: {
              type: "string",
              description: "One sentence on why this person fits, tied to the account context.",
            },
          },
          required: ["name", "title", "company", "rationale"],
        },
      },
    },
    required: ["contacts"],
  },
};

export interface FindContactsResult {
  contacts: FoundContact[];
  note?: string;
}

/** Find the right people at ONE company (a focused, deep pass). */
export async function findContactsForCompany(
  apiKey: string,
  accountName: string,
  contextText: string,
  company: string,
): Promise<FindContactsResult> {
  const { input, note } = await runResearchAgent({
    apiKey,
    system: contactsSystemPrompt(),
    user: contactsUserPrompt(accountName, contextText, company),
    submitTool: SUBMIT_CONTACTS,
    maxSearches: 8, // one company, but hunting both the sponsor and the functional owner
  });
  if (!input) return { contacts: [], note };
  const contacts = (input.contacts as FoundContact[] | undefined) ?? [];
  // Stamp the company so a mis-labelled result still lands under the right one.
  return { contacts: sanitize(contacts).map((c) => ({ ...c, company: c.company || company })) };
}

function sanitize(contacts: FoundContact[]): FoundContact[] {
  return contacts
    .map((c) => ({
      name: (c.name ?? "").trim(),
      title: (c.title ?? "").trim(),
      company: (c.company ?? "").trim(),
      email: (c.email ?? "").trim() || undefined,
      linkedin: (c.linkedin ?? "").trim() || undefined,
      rationale: (c.rationale ?? "").trim(),
    }))
    .filter((c) => c.name);
}
