/**
 * Eval harness for the Lab2Scale Deal Screen.
 *
 * Runs the screener over fixture leads with known-correct calls and checks it
 * holds the standard: right mandate call, a singular dominant risk, a proof, a
 * decisive verdict, no hedging. Run:
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
    lead: {
      company: "CarbonCore Batteries",
      sector: "Storage & Batteries",
      stage: "TRL 6",
      relevance: "8.6",
      whyItFits: "Solid-state battery maker with a running pilot line; targeting grid + EV.",
    },
    expect: (s) => [
      { name: "mandate IN (hardware)", pass: startsWith(s.mandateFit, "in") },
      { name: "not a mandate Pass", pass: !(s.verdict === "Pass" && has(s.mandateFit, /out/i)) },
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
      { name: "mandate OUT (software)", pass: startsWith(s.mandateFit, "out") },
      { name: "verdict Pass on mandate", pass: s.verdict === "Pass" },
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
      { name: "mandate IN (energy hardware)", pass: startsWith(s.mandateFit, "in") },
      { name: "not Pursue (too early)", pass: s.verdict !== "Pursue" },
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
      { name: "mandate OUT (consumer software)", pass: startsWith(s.mandateFit, "out") },
      { name: "verdict Pass", pass: s.verdict === "Pass" },
    ],
  },
  {
    lead: {
      company: "AquaGen Systems",
      sector: "Water generation",
      stage: "TRL 7, deployed pilots",
      relevance: "8.9",
      whyItFits: "Atmospheric water generation hardware with paying pilot sites in arid regions.",
    },
    expect: (s) => [{ name: "mandate IN (water hardware)", pass: startsWith(s.mandateFit, "in") }],
  },
];

function structural(s: Screen): { name: string; pass: boolean }[] {
  const risks = [s.technology, s.market, s.manufacturing, s.capital, s.regulatory];
  const substantive = risks.filter((r) => r.note.length > 10).length;
  const noHedge = !has(s.dominantRisk + " " + s.verdictReason, /\bmaybe\b|it depends|not sure/i);
  return [
    { name: "verdict is Pursue/Gate/Pass", pass: ["Pursue", "Gate", "Pass"].includes(s.verdict) },
    { name: "dominant risk present", pass: s.dominantRisk.length > 10 },
    { name: "dominant risk is singular", pass: !has(s.dominantRisk, /;.*;|\band also\b/i) },
    { name: "proof present", pass: s.proof.length > 10 },
    // Every risk line has a weight; the read is substantive where it matters
    // (off-mandate passes legitimately keep the hardware risks brief).
    { name: "all risks weighted", pass: risks.every((r) => r.weight.length > 0) },
    { name: "risk read substantive (>=3 real lines)", pass: substantive >= 3 },
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
    console.log(`  mandate: ${s.mandateFit}`);
    console.log(`  dominant risk: ${s.dominantRisk}`);
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
