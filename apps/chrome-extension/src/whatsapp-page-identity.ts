import { extractStableWhatsAppConversationId } from "./whatsapp-identity";

export const WHATSAPP_IDENTITY_REQUEST_EVENT =
  "convolens:whatsapp-identity-request";
export const WHATSAPP_IDENTITY_RESPONSE_EVENT =
  "convolens:whatsapp-identity-response";

interface IdentityRequestDetail {
  requestId?: unknown;
}

interface IdentityResponseDetail {
  requestId: string;
  sourceConversationId: string | null;
}

const ACTIVE_HEADER_SELECTORS = [
  '[data-testid="conversation-header"]',
  "#main header",
  '[data-testid="conversation-info-header"]',
];
const MAX_VISITED_OBJECTS = 5_000;
const MAX_DEPTH = 7;

function readChatIdentity(chat: unknown): string | undefined {
  if (!chat || typeof chat !== "object") return undefined;
  const candidate = chat as {
    id?: unknown;
    __x_id?: unknown;
  };
  const values: unknown[] = [];
  for (const value of [candidate.id, candidate.__x_id]) {
    if (typeof value === "string") {
      values.push(value);
    } else if (value && typeof value === "object") {
      const wid = value as { _serialized?: unknown };
      if (typeof wid._serialized === "string") values.push(wid._serialized);
    }
  }
  return extractStableWhatsAppConversationId(
    values.filter((value): value is string => typeof value === "string"),
  );
}

export function extractReactChatIdentity(
  element: Element | null,
): string | undefined {
  if (!element) return undefined;
  const roots = Object.getOwnPropertyNames(element)
    .filter((key) => key.startsWith("__reactProps$"))
    .map((key) => (element as unknown as Record<string, unknown>)[key])
    .filter((value): value is object =>
      Boolean(value && typeof value === "object"),
    );
  const stack = roots.map((value) => ({ value, depth: 0 }));
  const seen = new WeakSet<object>();
  const identities: string[] = [];
  let visited = 0;

  while (stack.length && visited < MAX_VISITED_OBJECTS) {
    const current = stack.pop()!;
    if (seen.has(current.value)) continue;
    seen.add(current.value);
    visited += 1;
    if (current.depth >= MAX_DEPTH) continue;

    for (const key of Reflect.ownKeys(current.value)) {
      if (typeof key !== "string") continue;
      const descriptor = Object.getOwnPropertyDescriptor(current.value, key);
      if (!descriptor || !("value" in descriptor)) continue;
      const value = descriptor.value;
      if (key === "chat") {
        const identity = readChatIdentity(value);
        if (identity) identities.push(identity);
        continue;
      }
      if (value && typeof value === "object") {
        stack.push({ value, depth: current.depth + 1 });
      }
    }
  }

  return extractStableWhatsAppConversationId(identities);
}

export function extractActiveWhatsAppConversationIdentity(
  root: ParentNode = document,
): string | undefined {
  const identities = ACTIVE_HEADER_SELECTORS.map((selector) =>
    extractReactChatIdentity(root.querySelector(selector)),
  );
  return extractStableWhatsAppConversationId(identities);
}

function dispatchIdentityResponse(detail: IdentityResponseDetail): void {
  document.dispatchEvent(
    new CustomEvent<IdentityResponseDetail>(WHATSAPP_IDENTITY_RESPONSE_EVENT, {
      detail,
    }),
  );
}

export function installWhatsAppIdentityBridge(): () => void {
  const handleRequest = (event: Event) => {
    const requestId = (event as CustomEvent<IdentityRequestDetail>).detail
      ?.requestId;
    if (typeof requestId !== "string" || requestId.length > 128) return;
    dispatchIdentityResponse({
      requestId,
      sourceConversationId: extractActiveWhatsAppConversationIdentity() || null,
    });
  };

  document.addEventListener(WHATSAPP_IDENTITY_REQUEST_EVENT, handleRequest);

  return () => {
    document.removeEventListener(
      WHATSAPP_IDENTITY_REQUEST_EVENT,
      handleRequest,
    );
  };
}

if (typeof document !== "undefined") {
  const bridgeDocument = document as Document & {
    __convolensWhatsAppIdentityBridgeCleanup?: () => void;
  };
  bridgeDocument.__convolensWhatsAppIdentityBridgeCleanup?.();
  bridgeDocument.__convolensWhatsAppIdentityBridgeCleanup =
    installWhatsAppIdentityBridge();
}
