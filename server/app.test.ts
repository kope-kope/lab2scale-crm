import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.ts";
import { makeRequireAuth } from "./auth/requireAuth.ts";
import type { Claims } from "./auth/evaluate.ts";

const config = { allowedDomain: "lab-2-scale.com", allowedEmails: [] };

const allowVerifier = async (): Promise<Claims> => ({
  email: "tosin@lab-2-scale.com",
  email_verified: true,
  hd: "lab-2-scale.com",
  name: "Tosin",
});

/** Boot the app on an ephemeral port and return its base URL + a stopper. */
async function boot() {
  const app = createApp(makeRequireAuth({ verify: allowVerifier, config }));
  const server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

test("/api/health is reachable without auth", async () => {
  const { base, stop } = await boot();
  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    await stop();
  }
});

test("/api/me is gated: 401 without a token", async () => {
  const { base, stop } = await boot();
  try {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  } finally {
    await stop();
  }
});

test("/api/me returns the user with a valid allowed token", async () => {
  const { base, stop } = await boot();
  try {
    const res = await fetch(`${base}/api/me`, {
      headers: { authorization: "Bearer valid-token" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { user: { email: string } };
    assert.equal(body.user.email, "tosin@lab-2-scale.com");
  } finally {
    await stop();
  }
});
