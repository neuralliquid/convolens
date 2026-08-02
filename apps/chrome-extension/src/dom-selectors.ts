export const MESSAGE_CONTAINER_SELECTOR =
  '[data-testid="msg-container"], .message-in, .message-out';

export const MESSAGE_TEXT_SELECTOR =
  '[data-testid="msg-text"], .selectable-text.copyable-text[dir], .selectable-text[dir]';

export const QUOTED_MESSAGE_SELECTOR =
  '[data-testid="quoted-message"], [data-testid="quoted-message-wrapper"], [data-testid="quoted-msg"], [data-quoted-message-id]';

export const MESSAGE_SENDER_SELECTOR =
  '[data-testid="msg-sender"], [data-testid="author"], [data-testid="message-author"], [data-testid="group-message-author"]';

const MESSAGE_REACTION_SELECTOR =
  '[data-testid*="reaction"], [data-icon*="reaction"], [data-reaction]';

export const MESSAGE_RECORD_EVIDENCE_SELECTOR = [
  MESSAGE_TEXT_SELECTOR,
  "[data-pre-plain-text]",
  QUOTED_MESSAGE_SELECTOR,
  "img.emoji[alt], img[data-emoji][alt], [data-emoji][aria-label]",
  'video, audio, [data-testid="image-thumb"], [data-testid="image-content"], [data-testid="video-thumb"], [data-testid="video-content"], .message-video, .message-image',
  '[data-testid="audio-player"], [data-testid="audio-content"], [data-testid="document-thumb"], [data-testid="document-content"], [data-testid="sticker"], [data-testid="sticker-content"], [data-testid="media-state-icon"]',
  '[data-icon="audio-play"], [data-icon="document"], img[alt="Sticker"], .message-audio, .message-document',
].join(", ");

const OUTER_MESSAGE_RECORD_SELECTOR = '[data-id], [role="row"]';

function closestMessageRecord(element: Element): HTMLElement | null {
  const quotedPreview = element.closest?.(QUOTED_MESSAGE_SELECTOR);
  const recordSearchRoot = quotedPreview?.parentElement || element;
  return (
    (recordSearchRoot.closest?.(
      OUTER_MESSAGE_RECORD_SELECTOR,
    ) as HTMLElement | null) ||
    (recordSearchRoot.closest?.(
      MESSAGE_CONTAINER_SELECTOR,
    ) as HTMLElement | null)
  );
}

function isQuotedEvidence(element: Element): boolean {
  return Boolean(element.closest?.(QUOTED_MESSAGE_SELECTOR));
}

export function hasCurrentMessageEvidence(
  container: Element,
  selector: string,
): boolean {
  const candidates = [
    ...(container.matches?.(selector) ? [container] : []),
    ...container.querySelectorAll(selector),
  ];
  return candidates.some((candidate) => !isQuotedEvidence(candidate));
}

/**
 * Return the active conversation body without depending on WhatsApp's
 * frequently renamed scrolling wrapper.
 */
export function findConversationRoot(
  documentRoot: ParentNode,
  primarySelector: string,
  fallbackSelector: string,
): Element | null {
  const configuredRoot =
    documentRoot.querySelector(primarySelector) ||
    documentRoot.querySelector(fallbackSelector);

  if (configuredRoot) return configuredRoot;

  const activeConversation = documentRoot.querySelector("#main");
  if (
    activeConversation?.querySelector(MESSAGE_CONTAINER_SELECTOR) ||
    activeConversation?.querySelector(MESSAGE_RECORD_EVIDENCE_SELECTOR)
  ) {
    return activeConversation;
  }

  return null;
}

/**
 * Merge configured message bubbles with text, metadata, reply, emoji, and media
 * evidence. WhatsApp can omit text nodes entirely and can change only some
 * container selectors, so returning early after one direct match loses valid
 * records.
 */
export function findMessageContainers(
  root: Element,
  primarySelector: string,
  fallbackSelector: string,
): HTMLElement[] {
  const containers = new Set<HTMLElement>();
  const candidates = root.querySelectorAll(
    `${primarySelector}, ${fallbackSelector}, ${MESSAGE_RECORD_EVIDENCE_SELECTOR}`,
  );
  for (const candidate of candidates) {
    const record = closestMessageRecord(candidate);
    if (record && (!root.contains || root.contains(record))) {
      containers.add(record);
    }
  }

  return Array.from(containers);
}

/**
 * A visual message bubble can be nested inside WhatsApp's actual message
 * record. Normalize to that record before reading metadata or sender fields,
 * because those fields may be siblings of the bubble rather than descendants.
 */
export function findMessageRecord(element: HTMLElement): HTMLElement {
  return closestMessageRecord(element) || element;
}

export function findMessageText(
  container: Element,
  primarySelector: string,
  fallbackSelector: string,
): Element | null {
  for (const selector of [
    primarySelector,
    fallbackSelector,
    MESSAGE_TEXT_SELECTOR,
  ]) {
    const candidates = [
      ...(container.matches?.(selector) ? [container] : []),
      ...container.querySelectorAll(selector),
    ];
    const match = candidates.find((candidate) => !isQuotedEvidence(candidate));
    if (match) return match;
  }
  return null;
}

export function findMessageEmojiText(container: Element): string | undefined {
  const emoji = Array.from(
    container.querySelectorAll(
      "img.emoji[alt], img[data-emoji][alt], [data-emoji][aria-label]",
    ),
  )
    .filter(
      (candidate) =>
        !isQuotedEvidence(candidate) &&
        !candidate.closest?.(MESSAGE_REACTION_SELECTOR),
    )
    .map(
      (candidate) =>
        candidate.getAttribute("alt") ||
        candidate.getAttribute("aria-label") ||
        "",
    )
    .join("")
    .trim();
  return emoji || undefined;
}

export function findMessageSender(
  container: Element,
  primarySelector: string,
  fallbackSelector: string,
): Element | null {
  for (const selector of [
    primarySelector,
    fallbackSelector,
    MESSAGE_SENDER_SELECTOR,
  ]) {
    const match = Array.from(container.querySelectorAll(selector)).find(
      (candidate) => !isQuotedEvidence(candidate),
    );
    if (match) return match;
  }
  return null;
}

export function findReplyTargetId(container: Element): string | undefined {
  const quoted = container.querySelector(QUOTED_MESSAGE_SELECTOR);
  if (!quoted) return undefined;
  const currentId = container.getAttribute("data-id")?.trim();
  for (const attribute of [
    "data-quoted-message-id",
    "data-message-id",
    "data-id",
  ]) {
    const candidate = quoted.getAttribute(attribute)?.trim();
    if (candidate && candidate !== currentId) return candidate;
  }
  return undefined;
}

export function resolveCapturedReplyTargets<
  T extends {
    id: string;
    replyTo?: string;
    captureSourceId?: string;
    captureReplyToSourceId?: string;
  },
>(messages: T[]): void {
  const exportedIdBySourceId = new Map(
    messages.flatMap((message) =>
      message.captureSourceId
        ? ([[message.captureSourceId, message.id]] as const)
        : [],
    ),
  );

  for (const message of messages) {
    const rawReplyTarget = message.captureReplyToSourceId;
    if (!rawReplyTarget) {
      delete message.replyTo;
      continue;
    }
    const exportedTargetId = exportedIdBySourceId.get(rawReplyTarget);
    if (exportedTargetId) {
      message.replyTo = exportedTargetId;
    } else {
      delete message.replyTo;
    }
  }
}

export function findSelfDisplayName(root: ParentNode): string | undefined {
  const candidates = [
    root
      .querySelector('[data-testid="menu-bar-avatar"][title]')
      ?.getAttribute("title"),
    root
      .querySelector('[data-testid="menu-bar-avatar"] img[alt]')
      ?.getAttribute("alt"),
    root
      .querySelector('[data-testid="default-user"][title]')
      ?.getAttribute("title"),
    root.querySelector('[aria-label="Profile"] [title]')?.getAttribute("title"),
    root.querySelector('[aria-label="Profile"] img[alt]')?.getAttribute("alt"),
  ];
  return candidates
    .map((candidate) => candidate?.trim())
    .find((candidate): candidate is string =>
      Boolean(candidate && !/^(profile|you|avatar)$/i.test(candidate)),
    );
}
