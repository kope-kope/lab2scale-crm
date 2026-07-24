import { test } from "node:test";
import assert from "node:assert/strict";
import { formatScreen, type Screen } from "./screen.ts";

/** Offline coverage for the pure formatter. The AI behaviour is checked by the
 *  live eval harness (scripts/eval-screen.ts). */

const SAMPLE: Screen = {
  company: "AquaGen",
  read: "Atmospheric water generation with paying pilots.",
  mandateFit: "In — water generation hardware.",
  dominantRisk: "Energy cost per liter in arid air.",
  technology: { weight: "medium", note: "Condensation works; efficiency at low RH unproven." },
  market: { weight: "high", note: "Who pays first is unclear." },
  manufacturing: { weight: "medium", note: "Standard components; assembly at volume untested." },
  capital: { weight: "medium", note: "Runway to the next pilot unclear." },
  regulatory: { weight: "low", note: "Water quality certification is routine." },
  incumbent: "Trucked water and desalination.",
  companyOrFeature: "Company.",
  proof: "Verified $/liter beating trucked water at pilot humidity.",
  verdict: "Gate",
  verdictReason: "Gate on the unit-economics number.",
};

test("formatScreen renders every section and the verdict line", () => {
  const out = formatScreen(SAMPLE);
  assert.match(out, /^SCREEN: AquaGen/);
  assert.match(out, /Dominant risk: Energy cost per liter/);
  assert.match(out, /Technology \(medium\):/);
  assert.match(out, /Regulatory \(low\):/);
  assert.match(out, /Proof that changes everything: Verified \$\/liter/);
  assert.match(out, /Verdict: Gate — Gate on the unit-economics number\./);
});
