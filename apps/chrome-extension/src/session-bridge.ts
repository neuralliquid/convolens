/**
 * Runs on the ConvoLens dashboard origin (convolens.neuralliquid.ai), where
 * the NextAuth session cookie is same-origin and always sent. The background
 * service worker's own session check is cross-origin from a chrome-extension://
 * origin, so a SameSite=Lax session cookie never reaches it there -- this
 * script is what actually detects a completed sign-in and hands the resulting
 * idToken to the background service worker to exchange for an extension
 * session.
 */

export const MYSTIRA_SESSION_OBSERVED_ACTION = "MYSTIRA_SESSION_OBSERVED";

interface DashboardSessionResponse {
  user?: unknown;
  idToken?: unknown;
}

async function checkAndPushMystiraSession(): Promise<void> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return;

    const session = (await response.json()) as DashboardSessionResponse;
    if (!session?.user || typeof session.idToken !== "string") return;

    await chrome.runtime.sendMessage({
      action: MYSTIRA_SESSION_OBSERVED_ACTION,
      idToken: session.idToken,
    });
  } catch {
    // Extension context can be transiently unavailable (e.g. a reload); the
    // next page load or tab focus retries.
  }
}

export function installMystiraSessionBridge(): () => void {
  void checkAndPushMystiraSession();

  const handleFocus = () => void checkAndPushMystiraSession();
  window.addEventListener("focus", handleFocus);

  return () => window.removeEventListener("focus", handleFocus);
}

if (typeof document !== "undefined") {
  const bridgeWindow = window as Window & {
    __convolensMystiraSessionBridgeCleanup?: () => void;
  };
  bridgeWindow.__convolensMystiraSessionBridgeCleanup?.();
  bridgeWindow.__convolensMystiraSessionBridgeCleanup =
    installMystiraSessionBridge();
}
