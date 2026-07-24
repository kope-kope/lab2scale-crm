import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "../finder/agent.js";

/**
 * The Lab2Scale Deal Screen — the qualification engine for leads.
 *
 * Adapted from the "Lab2Scale Deal Screen" instructions: a screen is a decision
 * document, not a summary. It answers one question — should we spend Lab2Scale's
 * time on this, and if so on what condition — via two non-negotiable calls (the
 * dominant risk, and the proof that changes everything), a five-risk read, the
 * incumbent alternative, and a single verdict: Pursue / Gate / Pass.
 *
 * (The project-specific scaffolding — knowledge-base uploads, auto-firing Skills,
 * "paste into custom instructions" — is stripped; this is the decision logic.)
 */

export type Verdict = "Pursue" | "Gate" | "Pass";
export type Weight = "low" | "medium" | "high" | "gating";

export interface RiskLine {
  weight: Weight;
  note: string;
}

export interface Screen {
  company: string;
  read: string;
  mandateFit: string;
  dominantRisk: string;
  technology: RiskLine;
  market: RiskLine;
  manufacturing: RiskLine;
  capital: RiskLine;
  regulatory: RiskLine;
  incumbent: string;
  companyOrFeature: string;
  proof: string;
  verdict: Verdict;
  verdictReason: string;
}

export interface LeadInput {
  index: number;
  company: string;
  sector?: string;
  stage?: string;
  whyItFits?: string;
  relevance?: string;
}

const RISK = {
  type: "object",
  properties: {
    weight: { type: "string", enum: ["low", "medium", "high", "gating"] },
    note: { type: "string", description: "One sharp line naming the SPECIFIC concern — not a generic label." },
  },
  required: ["weight", "note"],
} as const;

const SUBMIT_SCREEN: Anthropic.Tool = {
  name: "submit_screen",
  description: "Submit the deal screen for this one company. Lead with the calls; never hedge.",
  input_schema: {
    type: "object",
    properties: {
      read: { type: "string", description: "2–3 sentences: what this is, the real stage, and the bottom-line verdict in plain terms." },
      mandateFit: { type: "string", description: "One line. Start with 'In' or 'Out'. Lab2Scale commercializes HARDWARE deep-tech only." },
      dominantRisk: { type: "string", description: "The SINGLE thing most likely to kill this. Not a list. Name it plainly." },
      technology: RISK,
      market: RISK,
      manufacturing: RISK,
      capital: RISK,
      regulatory: RISK,
      incumbent: { type: "string", description: "What solves this today, and the honest reason a customer would/wouldn't switch. Name the competing approach the pitch omitted." },
      companyOrFeature: { type: "string", description: "Company or feature — which, and what it implies for the path/outcome." },
      proof: { type: "string", description: "The SINGLE de-risking milestone that would move this. Usually the gating condition." },
      verdict: { type: "string", enum: ["Pursue", "Gate", "Pass"] },
      verdictReason: { type: "string", description: "One line. Pursue → the first action. Gate → the exact condition. Pass → the reason." },
    },
    required: [
      "read", "mandateFit", "dominantRisk", "technology", "market", "manufacturing",
      "capital", "regulatory", "incumbent", "companyOrFeature", "proof", "verdict", "verdictReason",
    ],
  },
};

function systemPrompt(calibration: string): string {
  const base = [
    "You screen inbound and sourced deals for Lab2Scale, which commercializes HARDWARE deep-tech:",
    "semiconductors, power and energy generation, water generation, storage and batteries, and",
    "adjacent hard tech that makes real impact. A screen is a DECISION DOCUMENT, not a summary — it",
    "answers one question: should Lab2Scale spend time on this, and if so on what condition.",
    "",
    "MANDATE FIT, CHECKED FIRST. It must be hardware deep-tech. If a deal sits outside that mandate,",
    "say so in one line and it's a fast Pass on mandate — no matter how good the company is. Do not",
    "stretch the mandate to fit a deal.",
    "",
    "THE TWO CALLS THAT MATTER. Make both, explicitly, every time. Never hedge them:",
    "  1. The DOMINANT RISK — the single thing most likely to kill this. Not a list. One. Name it",
    "     plainly even when the deck is impressive.",
    "  2. The PROOF THAT CHANGES EVERYTHING — the one milestone that, if met, would de-risk the deal",
    "     enough to move. Usually the gating condition for any engagement.",
    "",
    "THE FIVE-RISK READ. Each one sharp line naming the SPECIFIC concern, with a weight (low, medium,",
    "high, or gating): Technology (what's unproven, on what evidence), Market (who pays first, what",
    "they do today, how urgent, how funded), Manufacturing & scale (buildable at volume at a cost",
    "that works, by whom), Capital (runway to the next proof, right mix of dilutive/non-dilutive),",
    "Regulatory (approvals, certification, insurability on the path).",
    "",
    "INCUMBENT ALTERNATIVE. What solves this problem today, and the honest reason a customer would or",
    "would not switch. Always name the competing approach the pitch left out. If there's genuinely",
    "none, say why.",
    "",
    "VERDICT — exactly one, never a maybe: Pursue (move now — say the first action), Gate (worth",
    "pursuing only after a specific proof — state the exact condition), or Pass (not for us now —",
    "state the reason in one line).",
    "",
    "ANTI-CHECKLIST RULES. Lead with the call, then support it. The dominant risk is SINGULAR — if",
    "everything is 'medium' and nothing is named as the killer, you've failed. The five-risk line",
    "that corresponds to your dominant risk MUST carry a weight of high or gating — a dominant risk",
    "can never be a 'medium'. Name each risk's specific concern in a line (on an off-mandate pass,",
    "one line noting the hardware risks are moot is fine). No 'it depends'",
    "without resolving what it depends on and making the call anyway. Be specific: name the customer,",
    "the competitor, the milestone, the number. If something essential to the two calls is missing",
    "from the lead, name the gap — an unanswered question is itself a finding. Match a high bar of",
    "specificity and decisiveness.",
    "",
    "Return the screen via submit_screen.",
  ];
  if (calibration.trim()) {
    base.push("", "--- Lab2Scale calibration notes (apply these) ---", calibration.trim(), "--- End calibration ---");
  }
  return base.join("\n");
}

function userPrompt(lead: LeadInput): string {
  return [
    `Screen this deal:`,
    "",
    `Company: ${lead.company}`,
    lead.sector ? `Sector: ${lead.sector}` : "",
    lead.stage ? `Stage: ${lead.stage}` : "",
    lead.relevance ? `Relevance score (internal): ${lead.relevance}` : "",
    lead.whyItFits ? `Why it was flagged: ${lead.whyItFits}` : "",
    "",
    "Produce the screen. If key facts are missing, name the gap and still make both calls and a verdict.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Run the deal screen on ONE lead. */
export async function screenLead(
  apiKey: string,
  calibration: string,
  lead: LeadInput,
): Promise<Screen> {
  const client = new Anthropic({ apiKey, maxRetries: 5 });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt(calibration),
    tools: [SUBMIT_SCREEN],
    tool_choice: { type: "tool", name: "submit_screen" },
    messages: [{ role: "user", content: userPrompt(lead) }],
  });
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_screen",
  );
  const s = (block?.input ?? {}) as Partial<Screen>;
  const risk = (r?: Partial<RiskLine>): RiskLine => ({
    weight: (["low", "medium", "high", "gating"] as Weight[]).includes(r?.weight as Weight)
      ? (r!.weight as Weight)
      : "medium",
    note: (r?.note ?? "").trim(),
  });
  const verdict: Verdict = (["Pursue", "Gate", "Pass"] as Verdict[]).includes(s.verdict as Verdict)
    ? (s.verdict as Verdict)
    : "Gate";
  return {
    company: lead.company,
    read: (s.read ?? "").trim(),
    mandateFit: (s.mandateFit ?? "").trim(),
    dominantRisk: (s.dominantRisk ?? "").trim(),
    technology: risk(s.technology),
    market: risk(s.market),
    manufacturing: risk(s.manufacturing),
    capital: risk(s.capital),
    regulatory: risk(s.regulatory),
    incumbent: (s.incumbent ?? "").trim(),
    companyOrFeature: (s.companyOrFeature ?? "").trim(),
    proof: (s.proof ?? "").trim(),
    verdict,
    verdictReason: (s.verdictReason ?? "").trim(),
  };
}

/** Render a screen into the multi-line text written to the sheet's Screen cell. */
export function formatScreen(s: Screen): string {
  const r = (label: string, x: RiskLine) => `  ${label} (${x.weight}): ${x.note}`;
  return [
    `SCREEN: ${s.company}`,
    `Read: ${s.read}`,
    `Mandate fit: ${s.mandateFit}`,
    `Dominant risk: ${s.dominantRisk}`,
    `Risk read:`,
    r("Technology", s.technology),
    r("Market", s.market),
    r("Manufacturing & scale", s.manufacturing),
    r("Capital", s.capital),
    r("Regulatory", s.regulatory),
    `Incumbent alternative: ${s.incumbent}`,
    `Company or feature: ${s.companyOrFeature}`,
    `Proof that changes everything: ${s.proof}`,
    `Verdict: ${s.verdict} — ${s.verdictReason}`,
  ].join("\n");
}
