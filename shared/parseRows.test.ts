import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSheet, toContacts } from "./parseRows.ts";

test("maps rows to objects keyed by header name", () => {
  const values = [
    ["id", "name", "status"],
    ["c1", "Ada Lovelace", "new"],
  ];
  assert.deepEqual(parseSheet(values), [
    { id: "c1", name: "Ada Lovelace", status: "new" },
  ]);
});

test("toContacts is tolerant of reordered columns", () => {
  const values = [
    ["name", "id", "email"],
    ["Ada Lovelace", "c1", "ada@example.com"],
  ];
  const [c] = toContacts(values);
  assert.equal(c.id, "c1");
  assert.equal(c.name, "Ada Lovelace");
  assert.equal(c.email, "ada@example.com");
});

test("toContacts drops unknown columns from the typed shape", () => {
  const values = [
    ["id", "name", "internal_note"],
    ["c1", "Ada", "ignore me"],
  ];
  const [c] = toContacts(values);
  assert.equal(c.name, "Ada");
  assert.equal((c as unknown as Record<string, unknown>).internal_note, undefined);
});

test("toContacts: missing optional field is undefined, not a crash", () => {
  const [c] = toContacts([
    ["id", "name"],
    ["c1", "Ada"],
  ]);
  assert.equal(c.email, undefined);
  assert.equal(c.account, undefined);
});

test("toContacts drops blank rows and rows without an id", () => {
  const values = [
    ["id", "name"],
    ["c1", "Ada"],
    ["", ""],
    ["", "orphan"],
    ["c2", "Grace"],
  ];
  const contacts = toContacts(values);
  assert.deepEqual(
    contacts.map((c) => c.id),
    ["c1", "c2"],
  );
});

test("trims whitespace in headers and cells", () => {
  const [c] = toContacts([
    [" id ", " company "],
    ["  c1  ", "  Widgets Inc "],
  ]);
  assert.equal(c.id, "c1");
  assert.equal(c.company, "Widgets Inc");
});

test("empty and header-only sheets yield no records", () => {
  assert.deepEqual(parseSheet([]), []);
  assert.deepEqual(toContacts([["id", "name"]]), []);
});
