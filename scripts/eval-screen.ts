/**
 * Eval harness for the Lab2Scale Client Qualification Screen.
 *
 * Runs the screener over fixture leads with known-correct calls and checks it
 * holds the standard: right sector call, a singular dominant risk, the client
 * calls (commercial-movability, fee-able event, client fit), a decisive verdict,
 * no hedging. The screener runs LIVE web search, so this makes real API calls.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/eval-screen.ts
 */
import { screenLead, type Screen, type LeadInput } from "../server/leads/screen.ts";

interface Fixture {
  lead: Omit<LeadInput, "index">;
  // Targeted, case-specific expectations (structural quality is checked for all).
  expect: (s: Screen) => { name: string; pass: boolean }[];
}

const startsWith = (s: string, w: string) => s.trim().toLowerCase().startsWith(w);
const has = (s: string, re: RegExp) => re.test(s);

const FIXTURES: Fixture[] = [
  {
    // Real, large, well-funded deep-tech — the "Overland" case. Strong tech, but
    // already scaled: a Pass on CLIENT FIT, not on sector or technology.
    lead: {
      company: "Overland AI",
      sector: "Autonomy / defense hardware",
      relevance: "8.0",
      whyItFits: "Autonomy stack for uncrewed ground vehicles; defense customers.",
    },
    expect: (s) => [
      { name: "verdict Pass", pass: s.verdict === "Pass" },
      {
        name: "passed on client-fit (already scaled), not tech",
        pass:
          has(s.clientFit + " " + s.verdictReason, /scal|funded|raised|large|series [b-z]|own commercial|doesn'?t need|do not need/i),
      },
    ],
  },
  {
    lead: {
      company: "CarbonCore Batteries",
      sector: "Storage & Batteries",
      stage: "TRL 6",
      relevance: "8.6",
      whyItFits: "Early solid-state battery maker with a running pilot line; targeting grid + EV. No large funding round yet.",
    },
    expect: (s) => [
      { name: "sector IN (hardware)", pass: startsWith(s.sectorFit, "in") },
      { name: "not a sector Pass", pass: !(s.verdict === "Pass" && has(s.sectorFit, /out/i)) },
    ],
  },
  {
    lead: {
      company: "FlowMetrics",
      sector: "SaaS / Sales analytics",
      stage: "Series A, live product",
      relevance: "5.0",
      whyItFits: "B2B software dashboard for sales teams. Pure software, no hardware.",
    },
    expect: (s) => [
      { name: "sector OUT (software)", pass: startsWith(s.sectorFit, "out") },
      { name: "verdict Pass on sector", pass: s.verdict === "Pass" },
    ],
  },
  {
    lead: {
      company: "FusionSpark",
      sector: "Power & Energy generation",
      stage: "Pre-prototype (simulations only)",
      relevance: "7.1",
      whyItFits: "Aneutronic fusion concept. No hardware demonstrator yet; physics unproven at scale.",
    },
    expect: (s) => [
      { name: "sector IN (energy hardware)", pass: startsWith(s.sectorFit, "in") },
      { name: "not Pursue (science risk commercial work can't move)", pass: s.verdict !== "Pursue" },
    ],
  },
  {
    lead: {
      company: "PetPal",
      sector: "Consumer mobile app",
      stage: "Launched on app stores",
      relevance: "3.2",
      whyItFits: "Social app for pet owners. Consumer software.",
    },
    expect: (s) => [
      { name: "sector OUT (consumer software)", pass: startsWith(s.sectorFit, "out") },
      { name: "verdict Pass", pass: s.verdict === "Pass" },
    ],
  },
  {
    lead: {
      company: "AquaGen Systems",
      sector: "Water generation",
      stage: "TRL 7, deployed pilots",
      relevance: "8.9",
      whyItFits: "Early atmospheric water generation hardware with paying pilot sites in arid regions; pre-Series A.",
    },
    expect: (s) => [{ name: "sector IN (water hardware)", pass: startsWith(s.sectorFit, "in") }],
  },
];

function structural(s: Screen): { name: string; pass: boolean }[] {
  const noHedge = !has(s.dominantRisk + " " + s.verdictReason, /\bmaybe\b|it depends|not sure/i);
  return [
    { name: "verdict is Pursue/Gate/Pass", pass: ["Pursue", "Gate", "Pass"].includes(s.verdict) },
    { name: "sector fit called (In/Out)", pass: startsWith(s.sectorFit, "in") || startsWith(s.sectorFit, "out") },
    { name: "dominant risk present", pass: s.dominantRisk.length > 10 },
    { name: "dominant risk is singular", pass: !has(s.dominantRisk, /;.*;|\band also\b/i) },
    { name: "commercial-movability call present", pass: s.commercialMovability.length > 10 },
    { name: "fee-able event addressed", pass: s.feeEvent.length > 8 },
    { name: "engagement type set", pass: ["Commercialization", "Capital", "Combined", "None"].includes(s.engagementType) },
    { name: "client-fit call present", pass: s.clientFit.length > 10 },
    { name: "proof present", pass: s.proof.length > 10 },
    { name: "verdict reason present", pass: s.verdictReason.length > 8 },
    { name: "no hedging", pass: noHedge },
  ];
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY to run the evals.");
    process.exit(2);
  }

  let passed = 0;
  let failed = 0;
  for (let i = 0; i < FIXTURES.length; i++) {
    const f = FIXTURES[i];
    process.stdout.write(`\n▶ ${f.lead.company}\n`);
    let s: Screen;
    try {
      s = await screenLead(apiKey, "", { index: i, ...f.lead });
    } catch (e) {
      console.error(`  ERROR: ${e instanceof Error ? e.message : e}`);
      failed++;
      continue;
    }
    console.log(`  verdict: ${s.verdict} — ${s.verdictReason}`);
    console.log(`  sector: ${s.sectorFit}`);
    console.log(`  dominant risk: ${s.dominantRisk}`);
    console.log(`  client fit: ${s.clientFit}`);
    const checks = [...structural(s), ...f.expect(s)];
    for (const c of checks) {
      console.log(`    ${c.pass ? "✓" : "✗"} ${c.name}`);
      c.pass ? passed++ : failed++;
    }
  }

  console.log(`\n=== ${passed} passed, ${failed} failed across ${FIXTURES.length} leads ===`);
  process.exit(failed ? 1 : 0);
}

void main();
