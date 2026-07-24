import { test } from "node:test";
import assert from "node:assert/strict";
import { formatScreen, type Screen } from "./screen.ts";

/** Offline coverage for the pure formatter. The AI behaviour is checked by the
 *  live eval harness (scripts/eval-screen.ts). */

const SAMPLE: Screen = {
  company: "AquaGen",
  read: "Atmospheric water generation with paying pilots.",
  facts: "Pre-Series A; ~15 people; two paid pilot sites; no disclosed institutional round.",
  sectorFit: "In — water generation hardware.",
  firstBuyer: "Arid-region industrial sites paying for trucked water today.",
  dominantRisk: "Energy cost per liter in arid air.",
  commercialMovability: "Movable — a first commercial water-supply contract is exactly what we'd drive.",
  stage: "TRL 7, deployed pilots.",
  feeEvent: "First commercial off-take contract, plus a non-dilutive grant round.",
  engagementType: "Combined",
  clientFit: "Genuine need — small team, no commercial org, needs first-buyer muscle.",
  incumbent: "Trucked water and desalination.",
  companyOrFeature: "Company.",
  proof: "Verified $/liter beating trucked water at pilot humidity.",
  verdict: "Gate",
  verdictReason: "Gate on the unit-economics number.",
};

test("formatScreen renders every section and the verdict line", () => {
  const out = formatScreen(SAMPLE);
  assert.match(out, /^SCREEN: AquaGen/);
  assert.match(out, /Sector fit: In — water generation hardware\./);
  assert.match(out, /Dominant risk: Energy cost per liter/);
  assert.match(out, /Can commercial work move it: Movable/);
  assert.match(out, /Engagement type: Combined/);
  assert.match(out, /Client fit \/ need: Genuine need/);
  assert.match(out, /Proof that changes everything: Verified \$\/liter/);
  assert.match(out, /Verdict: Gate — Gate on the unit-economics number\./);
});
