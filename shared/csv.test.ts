import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "./csv.ts";

test("parses a simple grid", () => {
  assert.deepEqual(parseCsv("id,name\na1,Apollo"), [
    ["id", "name"],
    ["a1", "Apollo"],
  ]);
});

test("handles quoted fields with commas", () => {
  assert.deepEqual(parseCsv('id,note\na1,"Hello, world"'), [
    ["id", "note"],
    ["a1", "Hello, world"],
  ]);
});

test("handles escaped quotes and newlines inside quotes", () => {
  const csv = 'id,note\na1,"line1\nline2 ""quoted"""';
  assert.deepEqual(parseCsv(csv), [
    ["id", "note"],
    ["a1", 'line1\nline2 "quoted"'],
  ]);
});

test("normalises CRLF line endings", () => {
  assert.deepEqual(parseCsv("id,name\r\na1,Apollo\r\n"), [
    ["id", "name"],
    ["a1", "Apollo"],
  ]);
});

test("empty input yields empty grid", () => {
  assert.deepEqual(parseCsv(""), []);
});

test("preserves empty trailing fields", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,3"), [
    ["a", "b", "c"],
    ["1", "", "3"],
  ]);
});
