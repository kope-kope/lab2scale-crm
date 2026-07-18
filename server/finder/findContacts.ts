import Anthropic from "@anthropic-ai/sdk";

/**
 * The AI contact finder (LAB-22).
 *
 * The account's context Google Doc is the whole brief: it says who we're
 * trying to reach and why. We hand that text to Claude with the web-search
 * tool, let it research real people, and have it hand back a structured list
 * via a `submit_contacts` tool call (structured JSON output can't be combined
 * with web-search citations, so a tool call is how we get clean structure).
 */

export interface FoundContact {
  /** Full name of the person. */
  name: string;
  /** Their role / job title. */
  title: string;
  /** The company they work at (the target company — not the account). */
  company: string;
  /** Work email, if one was found. */
  email?: string;
  /** LinkedIn profile URL, if one was found. */
  linkedin?: string;
  /** One line: why this person fits, grounded in the account context. */
  rationale: string;
}

const MODEL = "claude-opus-4-8";

const SUBMIT_TOOL: Anthropic.Tool = {
  name: "submit_contacts",
  description:
    "Submit the real, verified contacts you found. Call this exactly once, at the end, after your research is complete.",
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
            company: { type: "string", description: "The company they work at" },
            email: {
              type: "string",
              description: "Work email if you found a real one; otherwise leave empty. Never guess an address.",
            },
            linkedin: {
              type: "string",
              description: "LinkedIn profile URL if found; otherwise empty.",
            },
            rationale: {
              type: "string",
              description:
                "One sentence on why this person fits, tied to the account context.",
            },
          },
          required: ["name", "title", "company", "rationale"],
        },
      },
    },
    required: ["contacts"],
  },
};

function systemPrompt(): string {
  return [
    "You are a research assistant inside lab2scale's internal CRM. lab2scale takes deep-tech",
    "startups to market, so each 'account' is one of those startups. Your job is to find real",
    "people the account should reach — buyers, partners, or design partners at target companies.",
    "",
    "You will be given the account's context document. Treat it as the complete brief: follow its",
    "ideal-contact profile, target companies, and outreach angle exactly. Do not go off-brief.",
    "",
    "Use the web_search tool aggressively to find REAL, currently-employed people. Rules:",
    "- Cast a WIDE net. Work through every target company, tier, and persona in the brief, and run",
    "  multiple searches per company. Aim for 20–30 well-matched contacts — more is better.",
    "- Never invent a person, title, company, or email. If you can't verify someone is real, drop them —",
    "  but a verifiable name + title + company is enough to include, even without an email.",
    "- Only include an email if you found a genuine one; otherwise leave it empty. Prefer a LinkedIn URL",
    "  as proof the person exists.",
    "- Don't stop early. Keep searching across the full target list until you've exhausted good matches.",
    "",
    "When your research is done, call submit_contacts exactly once with the full list. Do not ask questions.",
  ].join("\n");
}

function userPrompt(accountName: string, contextText: string): string {
  const context = contextText.trim() || "(The context document is empty — infer sensible targets from the account name.)";
  return [
    `Account: ${accountName}`,
    "",
    "--- Account context document ---",
    context,
    "--- End of context document ---",
    "",
    "Find contacts for this account per the brief above, then call submit_contacts.",
  ].join("\n");
}

export interface FindContactsResult {
  contacts: FoundContact[];
  /** Any prose Claude produced (surfaced when it returned no structured list). */
  note?: string;
}

/**
 * Run the finder. `apiKey` is the Anthropic key (server-side only). Throws
 * Anthropic SDK errors on API failure — callers map those to HTTP responses.
 */
export async function findContacts(
  apiKey: string,
  accountName: string,
  contextText: string,
): Promise<FindContactsResult> {
  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userPrompt(accountName, contextText) },
  ];

  // Web search can pause the turn (pause_turn) for long agentic runs; resume
  // until Claude either submits contacts or ends its turn. Budgets are generous
  // because the finder is async — nobody's waiting, so we let it dig deep.
  for (let step = 0; step < 12; step++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: systemPrompt(),
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 20 }, SUBMIT_TOOL],
      messages,
    });
    const message = await stream.finalMessage();

    const submit = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_contacts",
    );
    if (submit) {
      const input = submit.input as { contacts?: FoundContact[] };
      return { contacts: sanitize(input.contacts ?? []) };
    }

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    // Ended without submitting — return whatever prose it left, as a note.
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { contacts: [], note: text || "The finder didn't return any contacts." };
  }

  return { contacts: [], note: "The finder ran out of research steps before finishing." };
}

/** Trim and drop rows missing the essentials, so the UI never shows blanks. */
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
