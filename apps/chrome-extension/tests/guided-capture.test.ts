import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeGuidedWindow,
  type GuidedWindowItem,
} from "../src/guided-capture";

interface FixtureMessage {
  id: number;
  sender: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
  mediaType?: string;
}

function fixtureItem(id: number): GuidedWindowItem<FixtureMessage> {
  const repeated = id === 195 || id === 196;
  const value = {
    id,
    sender: repeated ? "Participant A" : `Participant ${id % 5}`,
    text: repeated ? "Repeated fixture message" : `Message ${id}`,
    timestamp: repeated ? "2026-07-28T09:55:00.000Z" : `sequence-${id}`,
    isOutgoing: id % 3 === 0,
    mediaType: id % 17 === 0 ? "image" : undefined,
  };
  return {
    stableId: `fixture-${String(id).padStart(4, "0")}`,
    alignmentToken: JSON.stringify(value),
    value,
  };
}

test("collects all 200 records from overlapping 16-node guided windows", () => {
  const source = Array.from({ length: 200 }, (_, index) =>
    fixtureItem(index + 1),
  );
  let retained: GuidedWindowItem<FixtureMessage>[] = [];

  for (let end = 200; end > 0; end -= 12) {
    const start = Math.max(0, end - 16);
    retained = mergeGuidedWindow(
      retained,
      source.slice(start, end),
      "prepend",
    ).items;
  }

  assert.equal(retained.length, 200);
  assert.deepEqual(
    retained.map((item) => item.value.id),
    Array.from({ length: 200 }, (_, index) => index + 1),
  );
});

test("preserves repeated same-sender same-text same-minute occurrences", () => {
  const items = [fixtureItem(195), fixtureItem(196)];
  const result = mergeGuidedWindow([], items);

  assert.equal(result.items.length, 2);
  assert.notEqual(result.items[0].stableId, result.items[1].stableId);
  assert.deepEqual(
    result.items.map((item) => item.value.text),
    ["Repeated fixture message", "Repeated fixture message"],
  );
});

test("observing the same stable window twice creates no extra copies", () => {
  const window = Array.from({ length: 16 }, (_, index) =>
    fixtureItem(index + 1),
  );
  const first = mergeGuidedWindow([], window);
  const second = mergeGuidedWindow(first.items, window);

  assert.equal(second.items.length, 16);
  assert.equal(second.addedCount, 0);
  assert.equal(second.overlapCount, 16);
  assert.equal(second.ambiguous, false);
});

test("places a newly appended live-message window at the newer edge", () => {
  const existing = Array.from({ length: 16 }, (_, index) =>
    fixtureItem(index + 1),
  );
  const incoming = Array.from({ length: 8 }, (_, index) =>
    fixtureItem(index + 13),
  );
  const result = mergeGuidedWindow(existing, incoming, "append");

  assert.deepEqual(
    result.items.map((item) => item.value.id),
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  assert.equal(result.addedCount, 4);
});

test("fallback sequence alignment merges an unambiguous overlap", () => {
  const item = (token: string): GuidedWindowItem<string> => ({
    alignmentToken: token,
    value: token,
  });
  const result = mergeGuidedWindow(
    [item("c"), item("d"), item("e"), item("f")],
    [item("a"), item("b"), item("c"), item("d")],
    "prepend",
  );

  assert.deepEqual(
    result.items.map((entry) => entry.value),
    ["a", "b", "c", "d", "e", "f"],
  );
  assert.equal(result.overlapCount, 2);
  assert.equal(result.ambiguous, false);
});

test("treats a single fallback boundary token as occurrence-ambiguous", () => {
  const item = (
    token: string,
    occurrence: string,
  ): GuidedWindowItem<string> => ({
    alignmentToken: token,
    value: occurrence,
  });
  const existing = [item("same", "second occurrence"), item("later", "later")];
  const incoming = [item("older", "older"), item("same", "first occurrence")];
  const result = mergeGuidedWindow(existing, incoming, "prepend");

  assert.equal(result.ambiguous, true);
  assert.deepEqual(
    result.items.map((entry) => entry.value),
    ["older", "first occurrence", "second occurrence", "later"],
  );
});

test("does not collapse two identical single-message fallback windows", () => {
  const existing = [{ alignmentToken: "same", value: "first" }];
  const incoming = [{ alignmentToken: "same", value: "second" }];
  const result = mergeGuidedWindow(existing, incoming, "prepend");

  assert.equal(result.ambiguous, true);
  assert.deepEqual(
    result.items.map((item) => item.value),
    ["second", "first"],
  );
});

test("does not collapse two identical multi-message fallback windows", () => {
  const existing = [
    { alignmentToken: "same-a", value: "first a" },
    { alignmentToken: "same-b", value: "first b" },
  ];
  const incoming = [
    { alignmentToken: "same-a", value: "second a" },
    { alignmentToken: "same-b", value: "second b" },
  ];
  const result = mergeGuidedWindow(existing, incoming, "prepend");

  assert.equal(result.ambiguous, true);
  assert.deepEqual(
    result.items.map((item) => item.value),
    ["second a", "second b", "first a", "first b"],
  );
});

test("caps stable additions before they reach the retained payload", () => {
  const existing = Array.from({ length: 1_990 }, (_, index) =>
    fixtureItem(index + 1),
  );
  const incoming = Array.from({ length: 30 }, (_, index) =>
    fixtureItem(index + 1_981),
  );
  const result = mergeGuidedWindow(existing, incoming, "append", 2_000);

  assert.equal(result.items.length, 2_000);
  assert.equal(result.items.at(-1)?.value.id, 2_000);
  assert.equal(result.addedCount, 10);
  assert.equal(result.limitReached, true);
});

test("rejects an over-limit ambiguous window instead of dropping candidates", () => {
  const item = (token: string): GuidedWindowItem<string> => ({
    alignmentToken: token,
    value: token,
  });
  const existing = [item("same"), item("later")];
  const incoming = [item("older"), item("same")];
  const result = mergeGuidedWindow(existing, incoming, "prepend", 3);

  assert.equal(result.limitReached, true);
  assert.equal(result.ambiguous, true);
  assert.deepEqual(result.items, existing);
  assert.equal(result.addedCount, 0);
});

test("ambiguous fallback overlap retains candidates and raises a warning", () => {
  const item = (token: string): GuidedWindowItem<string> => ({
    alignmentToken: token,
    value: token,
  });
  const existing = [item("a"), item("b"), item("a"), item("b"), item("c")];
  const incoming = [item("a"), item("b"), item("a"), item("b")];
  const result = mergeGuidedWindow(existing, incoming, "prepend");

  assert.equal(result.ambiguous, true);
  assert.equal(result.items.length, existing.length + incoming.length);
  assert.equal(result.addedCount, incoming.length);
});
