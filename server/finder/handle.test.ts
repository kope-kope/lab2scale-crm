import { test } from "node:test";
import assert from "node:assert/strict";
import { handleFindContacts } from "./handle.ts";

/**
 * These cover the guardrails that run before any network call, so they need no
 * Anthropic key or Google token to exercise. The happy path (verify + Claude)
 * is integration-tested manually against the live APIs.
 */

test("returns 500 when the Anthropic key is missing", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = await handleFindContacts({ authHeader: "Bearer x", body: { accountName: "Acme" } });
    assert.equal(res.status, 500);
    assert.match((res.body as { error: string }).error, /configured/i);
  } finally {
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
  }
});

test("returns 401 when no bearer token is present", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test";
  try {
    const res = await handleFindContacts({ body: { accountName: "Acme" } });
    assert.equal(res.status, 401);
  } finally {
    if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prev;
  }
});

test("returns 400 when the account name is missing", async () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-test";
  try {
    const res = await handleFindContacts({ authHeader: "Bearer x", body: {} });
    assert.equal(res.status, 400);
  } finally {
    if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prev;
  }
});
