import assert from "node:assert/strict";
import test from "node:test";
import { classifyMediaEvidence } from "../src/media-evidence";

test("classifies a video thumbnail before its image descendant", () => {
  assert.equal(
    classifyMediaEvidence({
      video: true,
      image: true,
      audio: false,
      document: false,
      sticker: false,
    }),
    "video",
  );
});

test("uses neutral semantic media types", () => {
  assert.equal(
    classifyMediaEvidence({
      video: false,
      image: false,
      audio: false,
      document: true,
      sticker: false,
    }),
    "document",
  );
});
