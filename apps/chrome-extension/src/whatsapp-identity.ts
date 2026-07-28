export interface SenderEvidenceInput {
  metadataSender?: string;
  visibleSender?: string;
  headerSender?: string;
  scopedPhoneEvidence?: string[];
}

const PHONE_VALUE_PATTERN = /^\+?[0-9][0-9\s().-]*$/;
const PHONE_SUFFIX_PATTERN = /\s[·|]\s*(\+?[0-9][0-9\s().-]*)$/;
const WHATSAPP_JID_PATTERN =
  /([0-9][0-9A-Za-z.-]*@(?:g\.us|c\.us|s\.whatsapp\.net))/i;

export function normalizePhone(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const candidate = trimmed.match(PHONE_SUFFIX_PATTERN)?.[1] || trimmed;
  if (!PHONE_VALUE_PATTERN.test(candidate)) return undefined;
  const normalized = candidate.replace(/[^0-9+]/g, "");
  const digitCount = normalized.replace(/\D/g, "").length;
  const minimumDigits = normalized.startsWith("+") ? 8 : 9;
  return digitCount >= minimumDigits ? normalized : undefined;
}

function isPhoneOnly(value?: string): boolean {
  if (!value) return false;
  return Boolean(
    normalizePhone(value) && PHONE_VALUE_PATTERN.test(value.trim()),
  );
}

function displayNameFromCombinedLabel(value: string): string {
  const suffix = value.trim().match(PHONE_SUFFIX_PATTERN);
  if (!suffix || !normalizePhone(suffix[1])) return value.trim();
  const label = value.slice(0, suffix.index).trim();
  return label.replace(/^[\s·|,:;-]+|[\s·|,:;-]+$/g, "");
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
    ? displayNameFromCombinedLabel(displayCandidate) || displayCandidate.trim()
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
