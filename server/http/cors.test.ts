import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrigins, isAllowedOrigin } from "./cors.ts";

test("parseOrigins splits, trims, and drops blanks", () => {
  assert.deepEqual(parseOrigins("  a , b ,,c "), ["a", "b", "c"]);
  assert.deepEqual(parseOrigins(undefined), []);
  assert.deepEqual(parseOrigins(""), []);
});

test("exact origins match", () => {
  const allowed = ["https://lab2scale-crm.vercel.app"];
  assert.equal(isAllowedOrigin("https://lab2scale-crm.vercel.app", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.com", allowed), false);
});

test("wildcard host matches any subdomain (Vercel previews)", () => {
  const allowed = ["*.vercel.app"];
  assert.equal(isAllowedOrigin("https://lab2scale-crm-git-x-y.vercel.app", allowed), true);
  assert.equal(isAllowedOrigin("https://anything.vercel.app", allowed), true);
  // Must be a real subdomain, not a lookalike domain.
  assert.equal(isAllowedOrigin("https://notvercel.app", allowed), false);
  assert.equal(isAllowedOrigin("https://vercel.app.evil.com", allowed), false);
});

test("no allowed origins means nothing matches", () => {
  assert.equal(isAllowedOrigin("https://lab2scale-crm.vercel.app", []), false);
});
