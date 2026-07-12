import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, type Claims } from "./evaluate.ts";
import type { AuthConfig } from "./config.ts";

const DOMAIN = "lab-2-scale.com";
// Empty allowlist for the spoof cases — these must be rejected by hd alone,
// with no escape hatch masking a failure.
const strict: AuthConfig = { allowedDomain: DOMAIN, allowedEmails: [] };

function verified(claims: Partial<Claims>): Claims {
  return { email_verified: true, ...claims };
}

// --- The seven cases named explicitly in the issue's acceptance criteria ---

test("tosin@lab-2-scale.com with hd lab-2-scale.com → allowed", () => {
  const d = evaluate(verified({ email: "tosin@lab-2-scale.com", hd: DOMAIN }), strict);
  assert.equal(d.allow, true);
});

test("someone@gmail.com → denied", () => {
  const d = evaluate(verified({ email: "someone@gmail.com" }), strict);
  assert.equal(d.allow, false);
});

test("lab-2-scale.com email with NO hd claim → denied", () => {
  // A personal Gmail can set any email string; only hd is trustworthy.
  const d = evaluate(verified({ email: "tosin@lab-2-scale.com" }), strict);
  assert.equal(d.allow, false);
});

test("lookalike domain lab-2-scale.com.evil.com → denied", () => {
  const d = evaluate(
    verified({ email: "x@lab-2-scale.com.evil.com", hd: "lab-2-scale.com.evil.com" }),
    strict,
  );
  assert.equal(d.allow, false);
});

test("subdomain evil.lab-2-scale.com → denied", () => {
  const d = evaluate(
    verified({ email: "x@evil.lab-2-scale.com", hd: "evil.lab-2-scale.com" }),
    strict,
  );
  assert.equal(d.allow, false);
});

test("email_verified false → denied (even with a matching hd)", () => {
  const d = evaluate(
    { email: "tosin@lab-2-scale.com", hd: DOMAIN, email_verified: false },
    strict,
  );
  assert.equal(d.allow, false);
});

test("another Workspace a@stripe.com with hd stripe.com → denied", () => {
  const d = evaluate(verified({ email: "a@stripe.com", hd: "stripe.com" }), strict);
  assert.equal(d.allow, false);
});

// --- Allowlist escape hatch: exact match only, still requires verified email ---

test("allowlisted email with no hd → allowed", () => {
  const cfg: AuthConfig = { allowedDomain: DOMAIN, allowedEmails: ["amos@lab-2-scale.com"] };
  const d = evaluate(verified({ email: "amos@lab-2-scale.com" }), cfg);
  assert.equal(d.allow, true);
});

test("allowlist is exact match, not a suffix", () => {
  const cfg: AuthConfig = { allowedDomain: DOMAIN, allowedEmails: ["amos@lab-2-scale.com"] };
  const d = evaluate(verified({ email: "evil-amos@lab-2-scale.com" }), cfg);
  assert.equal(d.allow, false);
});

test("allowlist match is case-insensitive on the email", () => {
  const cfg: AuthConfig = { allowedDomain: DOMAIN, allowedEmails: ["amos@lab-2-scale.com"] };
  const d = evaluate(verified({ email: "Amos@Lab-2-Scale.com" }), cfg);
  assert.equal(d.allow, true);
});

test("allowlisted email but unverified → still denied", () => {
  const cfg: AuthConfig = { allowedDomain: DOMAIN, allowedEmails: ["amos@lab-2-scale.com"] };
  const d = evaluate({ email: "amos@lab-2-scale.com", email_verified: false }, cfg);
  assert.equal(d.allow, false);
});
