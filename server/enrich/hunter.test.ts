import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { emailFinder, emailVerifier, domainSearch, hunterConfigured, HunterError } from "./hunter.ts";

/** Offline coverage for the Hunter client's request shaping + response mapping.
 *  The network is stubbed; we assert the URL we build and the objects we return. */

const realFetch = globalThis.fetch;
const realKey = process.env.HUNTER_API_KEY;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.HUNTER_API_KEY;
  else process.env.HUNTER_API_KEY = realKey;
});

function stub(status: number, body: unknown): string[] {
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as typeof fetch;
  return urls;
}

test("hunterConfigured reflects the env var", () => {
  process.env.HUNTER_API_KEY = "k";
  assert.equal(hunterConfigured(), true);
  delete process.env.HUNTER_API_KEY;
  assert.equal(hunterConfigured(), false);
});

test("emailFinder maps a hit and sends company + full_name", async () => {
  process.env.HUNTER_API_KEY = "secret";
  const urls = stub(200, { data: { email: "jane@acme.com", score: 97, position: "CTO", email_type: "personal" } });
  const r = await emailFinder({ fullName: "Jane Roe", company: "Acme" });
  assert.equal(r.email, "jane@acme.com");
  assert.equal(r.score, 97);
  assert.equal(r.position, "CTO");
  const u = new URL(urls[0]);
  assert.equal(u.searchParams.get("company"), "Acme");
  assert.equal(u.searchParams.get("full_name"), "Jane Roe");
  assert.equal(u.searchParams.get("api_key"), "secret");
});

test("emailFinder returns email: null for a miss (not an error)", async () => {
  process.env.HUNTER_API_KEY = "secret";
  stub(200, { data: { email: null, score: null } });
  const r = await emailFinder({ fullName: "Nobody Here", company: "Acme" });
  assert.equal(r.email, null);
});

test("emailFinder throws without domain or company", async () => {
  process.env.HUNTER_API_KEY = "secret";
  await assert.rejects(() => emailFinder({ fullName: "Jane Roe" }), HunterError);
});

test("a Hunter error envelope becomes a HunterError with its details", async () => {
  process.env.HUNTER_API_KEY = "secret";
  stub(401, { errors: [{ code: 401, details: "Invalid API key" }] });
  await assert.rejects(
    () => emailFinder({ fullName: "Jane Roe", company: "Acme" }),
    (e: unknown) => e instanceof HunterError && e.status === 401 && /Invalid API key/.test(e.message),
  );
});

test("missing key throws before any request", async () => {
  delete process.env.HUNTER_API_KEY;
  await assert.rejects(() => emailVerifier("x@y.com"), (e: unknown) => e instanceof HunterError && e.status === 500);
});

test("domainSearch maps the people list", async () => {
  process.env.HUNTER_API_KEY = "secret";
  stub(200, {
    data: {
      domain: "acme.com",
      organization: "Acme",
      emails: [{ value: "a@acme.com", first_name: "A", last_name: "B", position: "Eng", confidence: 88 }],
    },
  });
  const r = await domainSearch({ company: "Acme" });
  assert.equal(r.domain, "acme.com");
  assert.equal(r.people.length, 1);
  assert.equal(r.people[0].email, "a@acme.com");
  assert.equal(r.people[0].confidence, 88);
});
