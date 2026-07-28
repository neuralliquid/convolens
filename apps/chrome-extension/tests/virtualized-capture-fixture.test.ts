import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fixture = readFileSync(
  new URL(
    "../src/__fixtures__/whatsapp-virtualized-16-of-200.html",
    import.meta.url,
  ),
  "utf8",
);

test("represents exactly 16 mounted records from a longer conversation", () => {
  const declaredSourceCount = Number(
    fixture.match(/data-source-total-message-count="(\d+)"/)?.[1],
  );
  const declaredRenderedCount = Number(
    fixture.match(/data-rendered-message-count="(\d+)"/)?.[1],
  );
  const mountedIds = [...fixture.matchAll(/<article\s+data-id="([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.equal(declaredSourceCount, 200);
  assert.equal(declaredRenderedCount, 16);
  assert.equal(mountedIds.length, declaredRenderedCount);
  assert.equal(new Set(mountedIds).size, mountedIds.length);
  assert.equal(mountedIds[0], "fixture-0185");
  assert.equal(mountedIds.at(-1), "fixture-0200");
  assert.ok(declaredRenderedCount < declaredSourceCount);
});

test("retains two stable same-sender, same-text, same-minute occurrences", () => {
  const repeatedRecords = fixture.match(
    /data-pre-plain-text="\[09:55, 28\/07\/2026\] Participant A: "/g,
  );
  const repeatedText = fixture.match(/>Repeated fixture message</g);

  assert.equal(repeatedRecords?.length, 2);
  assert.equal(repeatedText?.length, 2);
  assert.match(fixture, /data-id="fixture-0195"/);
  assert.match(fixture, /data-id="fixture-0196"/);
});
