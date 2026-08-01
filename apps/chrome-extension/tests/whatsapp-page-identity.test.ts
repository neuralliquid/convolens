import assert from "node:assert/strict";
import test from "node:test";
import { extractReactChatIdentity } from "../src/whatsapp-page-identity";

function reactBackedElement(value: unknown): Element {
  const element = {} as Element;
  Object.defineProperty(element, "__reactProps$fixture", { value });
  return element;
}

test("reads only the active React chat model identity", () => {
  const element = reactBackedElement({
    children: [
      {
        props: {
          chat: {
            id: { _serialized: "120363000000000000@g.us" },
            participants: [{ id: { _serialized: "27820000000@lid" } }],
          },
        },
      },
    ],
  });

  assert.equal(
    extractReactChatIdentity(element),
    "whatsapp:120363000000000000@g.us",
  );
});

test("fails closed when React chat models conflict or expose no JID", () => {
  assert.equal(
    extractReactChatIdentity(
      reactBackedElement({
        children: [
          { props: { chat: { id: { _serialized: "111111111@g.us" } } } },
          { props: { chat: { id: { _serialized: "222222222@g.us" } } } },
        ],
      }),
    ),
    undefined,
  );
  assert.equal(
    extractReactChatIdentity(
      reactBackedElement({ children: [{ props: { chat: { id: {} } } }] }),
    ),
    undefined,
  );
});
