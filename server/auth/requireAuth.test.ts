import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { makeRequireAuth } from "./requireAuth.ts";
import type { AuthConfig } from "./config.ts";
import type { Claims } from "./evaluate.ts";

const config: AuthConfig = { allowedDomain: "lab-2-scale.com", allowedEmails: [] };

/** Minimal Response double that records status + json and whether next ran. */
function fakeCtx(authorization?: string) {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };
  return { req, res: res as unknown as Response & typeof res, next, ranNext: () => nextCalled };
}

const allowVerifier = async (): Promise<Claims> => ({
  email: "tosin@lab-2-scale.com",
  email_verified: true,
  hd: "lab-2-scale.com",
  name: "Tosin",
});
const rejectVerifier = async (): Promise<Claims> => {
  throw new Error("invalid signature");
};
const disallowedVerifier = async (): Promise<Claims> => ({
  email: "someone@gmail.com",
  email_verified: true,
});

test("no Authorization header → 401, next not called", async () => {
  const mw = makeRequireAuth({ verify: allowVerifier, config });
  const { req, res, next, ranNext } = fakeCtx();
  await mw(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(ranNext(), false);
});

test("token that fails verification → 401", async () => {
  const mw = makeRequireAuth({ verify: rejectVerifier, config });
  const { req, res, next, ranNext } = fakeCtx("Bearer sometoken");
  await mw(req, res, next);
  assert.equal(res.statusCode, 401);
  assert.equal(ranNext(), false);
});

test("valid token from a disallowed account → 403", async () => {
  const mw = makeRequireAuth({ verify: disallowedVerifier, config });
  const { req, res, next, ranNext } = fakeCtx("Bearer sometoken");
  await mw(req, res, next);
  assert.equal(res.statusCode, 403);
  assert.equal(ranNext(), false);
});

test("valid allowed token → next() runs and req.user is set", async () => {
  const mw = makeRequireAuth({ verify: allowVerifier, config });
  const { req, res, next, ranNext } = fakeCtx("Bearer sometoken");
  await mw(req, res, next);
  assert.equal(ranNext(), true);
  assert.equal(res.statusCode, 0); // never responded
  assert.equal(req.user?.email, "tosin@lab-2-scale.com");
});

test("rejection message tells the person what to do", async () => {
  const mw = makeRequireAuth({ verify: rejectVerifier, config });
  const { req, res, next } = fakeCtx("Bearer sometoken");
  await mw(req, res, next);
  assert.match((res.body as { error: string }).error, /lab-2-scale\.com/);
});
