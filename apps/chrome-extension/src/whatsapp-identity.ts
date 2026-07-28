export interface SenderEvidenceInput {
  metadataSender?: string;
  visibleSender?: string;
  headerSender?: string;
  scopedPhoneEvidence?: string[];
}

const PHONE_PATTERN = /\+?[0-9][0-9\s().-]{5,}/;
const WHATSAPP_JID_PATTERN =
  /([0-9][0-9A-Za-z.-]*@(?:g\.us|c\.us|s\.whatsapp\.net))/i;

export function normalizePhone(value?: string): string | undefined {
  const match = value?.match(PHONE_PATTERN)?.[0];
  if (!match) return undefined;
  const normalized = match.replace(/[^0-9+]/g, "");
  return normalized.length >= 6 ? normalized : undefined;
}

function isPhoneOnly(value?: string): boolean {
  if (!value) return false;
  const phone = normalizePhone(value);
  return Boolean(phone && value.replace(PHONE_PATTERN, "").trim().length === 0);
}

function withoutPhone(value: string): string {
  return value
    .replace(PHONE_PATTERN, "")
    .replace(/^[\s·|,:;-]+|[\s·|,:;-]+$/g, "")
    .trim();
}

export function combineSenderEvidence(input: SenderEvidenceInput): {
  rawDisplayName?: string;
  normalizedPhone?: string;
  displayLabel?: string;
} {
  const candidates = [
    input.metadataSender,
    input.visibleSender,
    input.headerSender,
  ].filter((value): value is string => Boolean(value?.trim()));
  const displayCandidate = candidates.find((value) => !isPhoneOnly(value));
  const rawDisplayName = displayCandidate
    ? withoutPhone(displayCandidate) || displayCandidate.trim()
    : undefined;
  const normalizedPhone = [...candidates, ...(input.scopedPhoneEvidence || [])]
    .map(normalizePhone)
    .find(Boolean);
  const fallbackLabel = candidates[0]?.trim();
  const displayLabel = rawDisplayName
    ? normalizedPhone
      ? `${rawDisplayName} · ${normalizedPhone}`
      : rawDisplayName
    : normalizedPhone || fallbackLabel;

  return { rawDisplayName, normalizedPhone, displayLabel };
}

export function extractStableWhatsAppConversationId(
  values: Array<string | null | undefined>,
): string | undefined {
  for (const value of values) {
    const jid = value?.match(WHATSAPP_JID_PATTERN)?.[1]?.toLowerCase();
    if (jid) return `whatsapp:${jid}`;
  }
  return undefined;
}
