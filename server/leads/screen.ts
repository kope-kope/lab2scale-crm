import type Anthropic from "@anthropic-ai/sdk";
import { runResearchAgent } from "../finder/agent.js";

/**
 * The Lab2Scale Client Qualification Screen — the qualification engine for leads.
 *
 * Leads are prospective CLIENTS, not investments. Lab2Scale is a deep-tech
 * commercialization firm: it takes hardware deep-tech companies and drives their
 * commercial path (first buyers, partnerships, non-dilutive + dilutive capital)
 * for a fee. So the screen answers a different question from a VC deal screen:
 *
 *   Should Lab2Scale take this company on as a client — and can we get paid?
 *
 * That turns on three things a VC lens misses:
 *   1. Can COMMERCIAL WORK move the dominant risk? If the thing most likely to
 *      kill the company is pure science (physics that may never work), no amount
 *      of BD / capital / partnership work helps — it's not a client for us.
 *   2. Is there a FEE-ABLE COMMERCIAL EVENT we could drive — a first contract, a
 *      raise, a partnership — the kind of milestone Lab2Scale gets paid on.
 *   3. CLIENT FIT / genuine need. An already-scaled, well-funded company has its
 *      own commercial machine and doesn't need us — a Pass on fit even when the
 *      technology is excellent (the "Overland" case).
 *
 * The screen is GROUNDED IN RESEARCH: it runs web search (via runResearchAgent)
 * to establish the real facts — funding, stage, size, traction — before judging,
 * rather than screening from a sparse sheet row and training memory.
 */

export type Verdict = "Pursue" | "Gate" | "Pass";
export type EngagementType = "Commercialization" | "Capital" | "Combined" | "None";

export interface Screen {
  company: string;
  read: string;
  facts: string;
  sectorFit: string;
  firstBuyer: string;
  dominantRisk: string;
  commercialMovability: string;
  stage: string;
  feeEvent: string;
  engagementType: EngagementType;
  clientFit: string;
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

const SUBMIT_SCREEN: Anthropic.Tool = {
  name: "submit_screen",
  description:
    "Submit the client qualification screen for this one company, grounded in what you researched. Lead with the calls; never hedge.",
  input_schema: {
    type: "object",
    properties: {
      read: {
        type: "string",
        description:
          "2–3 sentences: what this company is, its real stage, and the bottom-line verdict in plain terms.",
      },
      facts: {
        type: "string",
        description:
          "The load-bearing facts you established from research — funding raised, last round + size, headcount/scale, traction (customers, contracts, deployments), founding year. If web search found little, say so plainly; do not invent numbers.",
      },
      sectorFit: {
        type: "string",
        description:
          "One line. Start with 'In' or 'Out'. Lab2Scale commercializes HARDWARE deep-tech (semiconductors, power & energy, water, storage & batteries, adjacent hard tech). Pure software / SaaS / consumer is Out.",
      },
      firstBuyer: {
        type: "string",
        description:
          "Who pays first for THIS COMPANY'S product — the specific first customer/segment, what they do today, and how urgent the need is.",
      },
      dominantRisk: {
        type: "string",
        description: "The SINGLE thing most likely to kill this company. Not a list. Name it plainly.",
      },
      commercialMovability: {
        type: "string",
        description:
          "Can Lab2Scale's commercial work (BD, first-buyer development, partnerships, capital) actually MOVE the dominant risk? If the dominant risk is pure science/physics that commercial work can't touch, say so — that's the deciding factor.",
      },
      stage: { type: "string", description: "Where the company actually is — TRL / commercial stage / traction, in one line." },
      feeEvent: {
        type: "string",
        description:
          "The specific fee-able commercial event Lab2Scale could drive and get paid on — a first commercial contract, a strategic partnership, a non-dilutive or dilutive raise. If there's no near-term event we could earn on, say so.",
      },
      engagementType: {
        type: "string",
        enum: ["Commercialization", "Capital", "Combined", "None"],
        description:
          "What Lab2Scale would actually do: Commercialization (first buyers / partnerships / GTM), Capital (raise), Combined, or None (no viable engagement).",
      },
      clientFit: {
        type: "string",
        description:
          "Does this company genuinely NEED Lab2Scale? An already-scaled, well-funded company with its own commercial machine does not — call that out even when the tech is excellent. This is the client-fit gate, distinct from whether the tech is good.",
      },
      incumbent: {
        type: "string",
        description:
          "What solves this company's target problem today, and the honest reason its customers would or would not switch. Name the competing approach the pitch omitted.",
      },
      companyOrFeature: {
        type: "string",
        description: "Is this a company or a feature — which, and what it implies for the commercial path.",
      },
      proof: {
        type: "string",
        description: "The SINGLE de-risking milestone that would move this. Usually the gating condition for an engagement.",
      },
      verdict: { type: "string", enum: ["Pursue", "Gate", "Pass"] },
      verdictReason: {
        type: "string",
        description:
          "One line. Pursue → the first action + engagement type. Gate → the exact condition. Pass → the reason (name whether it's sector, client-fit, or commercial-movability).",
      },
    },
    required: [
      "read", "facts", "sectorFit", "firstBuyer", "dominantRisk", "commercialMovability", "stage",
      "feeEvent", "engagementType", "clientFit", "incumbent", "companyOrFeature", "proof", "verdict", "verdictReason",
    ],
  },
};

function systemPrompt(calibration: string): string {
  const base = [
    "You screen prospective CLIENTS for Lab2Scale, a deep-tech commercialization firm. Lab2Scale takes",
    "HARDWARE deep-tech companies (semiconductors, power & energy generation, water generation, storage",
    "& batteries, and adjacent hard tech) and drives their commercial path — first buyers, strategic",
    "partnerships, and non-dilutive + dilutive capital — FOR A FEE. A screen is a DECISION DOCUMENT, not",
    "a summary. It answers one question: should Lab2Scale take this company on as a client, and can we",
    "get paid.",
    "",
    "RESEARCH FIRST. Use web search to establish the real facts before you judge — funding raised, last",
    "round and size, headcount/scale, traction (customers, contracts, deployments), founding year. Screen",
    "from what you FIND, not from the sheet row or memory. If search turns up little, say so and screen on",
    "what you have — but never invent funding numbers or customers.",
    "",
    "THE THREE CALLS THAT DECIDE A CLIENT (a VC deal screen misses these — make all three, explicitly):",
    "  1. CAN COMMERCIAL WORK MOVE THE DOMINANT RISK? Name the single thing most likely to kill the",
    "     company, then ask whether Lab2Scale's commercial work can touch it. If the killer is pure",
    "     science/physics that BD, partnerships, and capital can't move, this is not a client for us —",
    "     no matter how exciting the tech.",
    "  2. IS THERE A FEE-ABLE COMMERCIAL EVENT? A first commercial contract, a strategic partnership, or a",
    "     raise that Lab2Scale could drive and earn on. If there's no near-term event we could get paid on,",
    "     there's no engagement.",
    "  3. CLIENT FIT / GENUINE NEED. An already-scaled, well-funded company runs its own commercial machine",
    "     and does not need Lab2Scale — that is a Pass on FIT even when the technology is excellent. This is",
    "     the single most common false positive: a great company that is simply too big to be our client.",
    "",
    "SECTOR FIT, CHECKED FIRST. It must be hardware deep-tech. Pure software / SaaS / consumer / fintech is",
    "a fast Pass on sector — say so in one line, no matter how good the company is.",
    "",
    "ALSO READ: the first buyer (who pays the CLIENT first, and how urgently), the real stage, the incumbent",
    "alternative (what solves the problem today, why a customer would/wouldn't switch — name the approach the",
    "pitch omitted), and whether this is a company or a feature.",
    "",
    "VERDICT — exactly one, never a maybe: Pursue (take them on — say the first action and the engagement",
    "type), Gate (worth pursuing only after a specific proof — state the exact condition), or Pass (not a",
    "client for us now — state the reason and whether it's sector, client-fit, or commercial-movability).",
    "",
    "ANTI-CHECKLIST RULES. Lead with the call, then support it. The dominant risk is SINGULAR. Be specific:",
    "name the buyer, the competitor, the milestone, the funding number you found. No 'it depends' without",
    "resolving what it depends on and making the call anyway. If something essential is missing after",
    "research, name the gap — an unanswered question is itself a finding. Hold a high bar of specificity and",
    "decisiveness. When you have enough to judge, submit the screen via submit_screen.",
  ];
  if (calibration.trim()) {
    base.push("", "--- Lab2Scale calibration notes (apply these) ---", calibration.trim(), "--- End calibration ---");
  }
  return base.join("\n");
}

function userPrompt(lead: LeadInput): string {
  return [
    "Screen this prospective client. Research the company on the web first, then produce the screen.",
    "",
    `Company: ${lead.company}`,
    lead.sector ? `Sector (as flagged): ${lead.sector}` : "",
    lead.stage ? `Stage (as flagged): ${lead.stage}` : "",
    lead.relevance ? `Relevance score (internal): ${lead.relevance}` : "",
    lead.whyItFits ? `Why it was flagged: ${lead.whyItFits}` : "",
    "",
    "Establish the real facts (funding, stage, size, traction), then make all three client calls and a",
    "verdict. If research is thin, name the gap and still make the calls.",
  ]
    .filter(Boolean)
    .join("\n");
}

const VERDICTS: Verdict[] = ["Pursue", "Gate", "Pass"];
const ENGAGEMENTS: EngagementType[] = ["Commercialization", "Capital", "Combined", "None"];

/** Run the client qualification screen on ONE lead, grounded in web research. */
export async function screenLead(apiKey: string, calibration: string, lead: LeadInput): Promise<Screen> {
  const result = await runResearchAgent({
    apiKey,
    system: systemPrompt(calibration),
    user: userPrompt(lead),
    submitTool: SUBMIT_SCREEN,
    // A focused per-company pass — enough to establish funding/stage/traction.
    maxSearches: 6,
  });

  const s = (result.input ?? {}) as Partial<Screen>;
  const verdict: Verdict = VERDICTS.includes(s.verdict as Verdict) ? (s.verdict as Verdict) : "Gate";
  const engagementType: EngagementType = ENGAGEMENTS.includes(s.engagementType as EngagementType)
    ? (s.engagementType as EngagementType)
    : "None";
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  // If the agent never submitted (ran out of steps / left prose), surface that
  // as a Gate with the note rather than a silent empty screen.
  const fellShort = !result.input;
  return {
    company: lead.company,
    read: str(s.read) || (fellShort ? (result.note ?? "").trim() : ""),
    facts: str(s.facts),
    sectorFit: str(s.sectorFit),
    firstBuyer: str(s.firstBuyer),
    dominantRisk: str(s.dominantRisk),
    commercialMovability: str(s.commercialMovability),
    stage: str(s.stage),
    feeEvent: str(s.feeEvent),
    engagementType,
    clientFit: str(s.clientFit),
    incumbent: str(s.incumbent),
    companyOrFeature: str(s.companyOrFeature),
    proof: str(s.proof),
    verdict,
    verdictReason: str(s.verdictReason),
  };
}

/** Render a screen into the multi-line text written to the sheet's Screen cell. */
export function formatScreen(s: Screen): string {
  return [
    `SCREEN: ${s.company}`,
    `Read: ${s.read}`,
    `Facts: ${s.facts}`,
    `Sector fit: ${s.sectorFit}`,
    `First buyer: ${s.firstBuyer}`,
    `Dominant risk: ${s.dominantRisk}`,
    `Can commercial work move it: ${s.commercialMovability}`,
    `Stage: ${s.stage}`,
    `Fee-able event: ${s.feeEvent}`,
    `Engagement type: ${s.engagementType}`,
    `Client fit / need: ${s.clientFit}`,
    `Incumbent alternative: ${s.incumbent}`,
    `Company or feature: ${s.companyOrFeature}`,
    `Proof that changes everything: ${s.proof}`,
    `Verdict: ${s.verdict} — ${s.verdictReason}`,
  ].join("\n");
}
