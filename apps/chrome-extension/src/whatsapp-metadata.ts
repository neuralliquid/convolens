export interface WhatsAppMessageMetadata {
  sender?: string;
  timestamp?: string;
}

/** Parse WhatsApp's `[time, date] sender:` accessibility metadata. */
export function parseWhatsAppMessageMetadata(value: string): WhatsAppMessageMetadata {
  const match = value.match(/^\[([^\]]+)\]\s*(.+?):\s*$/);
  if (!match) return {};

  return {
    sender: match[2].trim() || undefined,
    timestamp: parseWhatsAppMetadataTimestamp(match[1]),
  };
}

function parseWhatsAppMetadataTimestamp(value: string): string | undefined {
  const dayFirstDate = value.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  const yearFirstDate = value.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  const time = value.match(/(?:^|,\s*)(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if ((!dayFirstDate && !yearFirstDate) || !time) return undefined;

  const day = Number(yearFirstDate?.[3] || dayFirstDate?.[1]);
  const month = Number(yearFirstDate?.[2] || dayFirstDate?.[2]);
  const year = Number(yearFirstDate?.[1] || dayFirstDate?.[3]);
  let hours = Number(time[1]);
  const minutes = Number(time[2]);
  const period = time[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
