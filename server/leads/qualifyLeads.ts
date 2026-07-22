import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../finder/agent.js";
import type { Verdict } from "./leadsSheet.js";

/**
 * Qualify leads against a rules doc in a single structured call — one verdict
 * (Qualified / Disqualified + reason) per lead. No web search: this is applying
 * the user's rules to the lead data, so it's fast and deterministic-ish.
 */

export interface LeadInput {
  index: number;
  company: string;
  sector?: string;
  stage?: string;
  whyItFits?: string;
  relevance?: string;
}

const SUBMIT_VERDICTS: Anthropic.Tool = {
  name: "submit_verdicts",
  description: "Submit one verdict per lead. Include EVERY lead you were given, matched by index.",
  input_schema: {
    type: "object",
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer", description: "The lead's index, exactly as given." },
            company: { type: "string" },
            decision: { type: "string", enum: ["Qualified", "Disqualified"] },
            reason: { type: "string", description: "One short sentence, grounded in the rules." },
          },
          required: ["index", "company", "decision", "reason"],
        },
      },
    },
    required: ["verdicts"],
  },
};

function systemPrompt(rules: string): string {
  return [
    "You qualify inbound leads for lab2scale, a firm that takes deep-tech startups to market.",
    "Apply the qualification rules below to each lead. For each, decide Qualified or Disqualified",
    "and give one short reason grounded in the rules. Judge only against the rules and the lead data",
    "given — do not invent facts about the company.",
    "",
    "--- Qualification rules ---",
    rules.trim() || "(No rules provided — qualify only clearly deep-tech, demonstrated-technology companies.)",
    "--- End of rules ---",
    "",
    "Return a verdict for EVERY lead via submit_verdicts, matched by index.",
  ].join("\n");
}

function leadsPrompt(leads: LeadInput[]): string {
  const lines = leads.map((l) =>
    [
      `#${l.index} ${l.company}`,
      l.sector ? `  sector: ${l.sector}` : "",
      l.stage ? `  stage: ${l.stage}` : "",
      l.relevance ? `  relevance: ${l.relevance}` : "",
      l.whyItFits ? `  why it fits: ${l.whyItFits}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return `Qualify these ${leads.length} leads:\n\n${lines.join("\n\n")}`;
}

export async function qualifyLeads(
  apiKey: string,
  rules: string,
  leads: LeadInput[],
): Promise<Verdict[]> {
  if (!leads.length) return [];
  const client = new Anthropic({ apiKey, maxRetries: 5 });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt(rules),
    tools: [SUBMIT_VERDICTS],
    tool_choice: { type: "tool", name: "submit_verdicts" },
    messages: [{ role: "user", content: leadsPrompt(leads) }],
  });
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_verdicts",
  );
  const verdicts = (block?.input as { verdicts?: Verdict[] } | undefined)?.verdicts ?? [];
  return verdicts.map((v) => ({
    index: Number(v.index),
    company: String(v.company ?? "").trim(),
    decision: v.decision === "Qualified" ? "Qualified" : "Disqualified",
    reason: String(v.reason ?? "").trim(),
  }));
}
