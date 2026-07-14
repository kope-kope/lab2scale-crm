import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSheet, toAccounts, toLeads } from "./parseRows.ts";

test("maps rows to objects keyed by header name", () => {
  const values = [
    ["id", "name", "status"],
    ["a1", "Apollo Atomics", "active"],
  ];
  assert.deepEqual(parseSheet(values), [
    { id: "a1", name: "Apollo Atomics", status: "active" },
  ]);
});

test("is tolerant of reordered columns", () => {
  const values = [
    ["name", "id", "owner"],
    ["Apollo Atomics", "a1", "Amos"],
  ];
  const [acc] = toAccounts(values);
  assert.equal(acc.id, "a1");
  assert.equal(acc.name, "Apollo Atomics");
  assert.equal(acc.owner, "Amos");
});

test("drops unknown columns from the typed shape", () => {
  const values = [
    ["id", "name", "internal_note"],
    ["a1", "Apollo Atomics", "ignore me"],
  ];
  const [acc] = toAccounts(values);
  assert.equal(acc.name, "Apollo Atomics");
  assert.equal((acc as unknown as Record<string, unknown>).internal_note, undefined);
});

test("missing optional field is undefined, not a crash", () => {
  const values = [
    ["id", "name"],
    ["a1", "Apollo Atomics"],
  ];
  const [acc] = toAccounts(values);
  assert.equal(acc.website, undefined);
  assert.equal(acc.status, undefined);
});

test("drops blank rows and rows without an id", () => {
  const values = [
    ["id", "name"],
    ["a1", "Apollo Atomics"],
    ["", ""],
    ["", "orphan with no id"],
    ["a2", "Second"],
  ];
  const accts = toAccounts(values);
  assert.equal(accts.length, 2);
  assert.deepEqual(
    accts.map((a) => a.id),
    ["a1", "a2"],
  );
});

test("trims whitespace in headers and cells", () => {
  const values = [
    [" id ", " company "],
    ["  l1  ", "  Widgets Inc "],
  ];
  const [lead] = toLeads(values);
  assert.equal(lead.id, "l1");
  assert.equal(lead.company, "Widgets Inc");
});

test("empty grid yields no records", () => {
  assert.deepEqual(parseSheet([]), []);
  assert.deepEqual(toAccounts([]), []);
});

test("header-only sheet yields no records", () => {
  const values = [["id", "name", "website", "stage", "one_liner", "status", "owner"]];
  assert.deepEqual(toAccounts(values), []);
});
