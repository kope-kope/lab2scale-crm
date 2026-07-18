import Anthropic from "@anthropic-ai/sdk";
import { runResearchAgent } from "./agent.js";
import { companiesSystemPrompt, companiesUserPrompt } from "./prompts.js";

/** Stage 1: find target COMPANIES for an account, for a human to approve. */

export interface FoundCompany {
  /** The company name. */
  company: string;
  /** One line: why it fits, grounded in the account context. */
  rationale: string;
  /** Tier / segment, if the brief defines them; otherwise empty. */
  tier?: string;
}

const SUBMIT_COMPANIES: Anthropic.Tool = {
  name: "submit_companies",
  description:
    "Submit the real, verified target companies you found. Call this exactly once, at the end.",
  input_schema: {
    type: "object",
    properties: {
      companies: {
        type: "array",
        description: "The target companies. Omit any you can't verify are real.",
        items: {
          type: "object",
          properties: {
            company: { type: "string", description: "Company name" },
            rationale: {
              type: "string",
              description: "One sentence on why this company fits, tied to the account context.",
            },
            tier: {
              type: "string",
              description: "Tier or segment from the brief, if applicable; otherwise empty.",
            },
          },
          required: ["company", "rationale"],
        },
      },
    },
    required: ["companies"],
  },
};

export interface FindCompaniesResult {
  companies: FoundCompany[];
  note?: string;
}

export async function findCompanies(
  apiKey: string,
  accountName: string,
  contextText: string,
): Promise<FindCompaniesResult> {
  const { input, note } = await runResearchAgent({
    apiKey,
    system: companiesSystemPrompt(),
    user: companiesUserPrompt(accountName, contextText),
    submitTool: SUBMIT_COMPANIES,
  });
  if (!input) return { companies: [], note };
  const companies = (input.companies as FoundCompany[] | undefined) ?? [];
  return { companies: sanitize(companies) };
}

function sanitize(companies: FoundCompany[]): FoundCompany[] {
  return companies
    .map((c) => ({
      company: (c.company ?? "").trim(),
      rationale: (c.rationale ?? "").trim(),
      tier: (c.tier ?? "").trim() || undefined,
    }))
    .filter((c) => c.company);
}
