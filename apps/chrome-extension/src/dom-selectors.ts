export const MESSAGE_CONTAINER_SELECTOR =
  '[data-testid="msg-container"], .message-in, .message-out';

export const MESSAGE_TEXT_SELECTOR =
  '[data-testid="msg-text"], .selectable-text.copyable-text[dir], .selectable-text[dir]';

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
    activeConversation?.querySelector(MESSAGE_TEXT_SELECTOR)
  ) {
    return activeConversation;
  }

  return null;
}

/**
 * Prefer message bubbles, but recover from class churn by walking from stable
 * selectable message text to its nearest message record.
 */
export function findMessageContainers(
  root: Element,
  primarySelector: string,
  fallbackSelector: string,
): HTMLElement[] {
  const directMatches = Array.from(
    root.querySelectorAll(`${primarySelector}, ${fallbackSelector}`),
  ) as HTMLElement[];

  if (directMatches.length > 0) return directMatches;

  const containers = new Set<HTMLElement>();
  const textNodes = root.querySelectorAll(MESSAGE_TEXT_SELECTOR);

  for (const textNode of textNodes) {
    const container = textNode.closest(
      '[data-id], [role="row"], .message-in, .message-out',
    ) as HTMLElement | null;

    if (container && (!root.contains || root.contains(container))) {
      containers.add(container);
    }
  }

  return Array.from(containers);
}

export function findMessageText(
  container: Element,
  primarySelector: string,
  fallbackSelector: string,
): Element | null {
  const selectors = `${primarySelector}, ${fallbackSelector}, ${MESSAGE_TEXT_SELECTOR}`;

  if (container.matches?.(selectors)) return container;

  return (
    container.querySelector(primarySelector) ||
    container.querySelector(fallbackSelector) ||
    container.querySelector(MESSAGE_TEXT_SELECTOR)
  );
}
