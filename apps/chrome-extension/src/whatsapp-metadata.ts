export interface WhatsAppMessageMetadata {
  sender?: string;
  timestamp?: string;
}

/** Parse WhatsApp's `[time, date] sender:` accessibility metadata. */
export function parseWhatsAppMessageMetadata(
  value: string,
  locale?: string,
): WhatsAppMessageMetadata {
  const match = value.match(/^\[([^\]]+)\]\s*(.+?):\s*$/);
  if (!match) return {};

  return {
    sender: match[2].trim() || undefined,
    timestamp: parseWhatsAppMetadataTimestamp(match[1], locale),
  };
}

function parseWhatsAppMetadataTimestamp(value: string, locale?: string): string | undefined {
  const dayFirstDate = value.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  const yearFirstDate = value.match(/(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
  const time = value.match(/(?:^|,\s*)(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if ((!dayFirstDate && !yearFirstDate) || !time) return undefined;

  const numericDateIsMonthFirst = !yearFirstDate && isMonthFirstLocale(locale);
  const day = Number(yearFirstDate?.[3] || (numericDateIsMonthFirst ? dayFirstDate?.[2] : dayFirstDate?.[1]));
  const month = Number(yearFirstDate?.[2] || (numericDateIsMonthFirst ? dayFirstDate?.[1] : dayFirstDate?.[2]));
  const year = Number(yearFirstDate?.[1] || dayFirstDate?.[3]);
  let hours = Number(time[1]);
  const minutes = Number(time[2]);
  const period = time[3]?.toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  // WhatsApp's accessibility label has no timezone. Preserve its displayed
  // calendar date and clock time rather than letting the browser timezone
  // shift historical messages across a UTC date boundary.
  const parsed = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  return Number.isNaN(parsed.getTime()) ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day ||
      parsed.getUTCHours() !== hours ||
      parsed.getUTCMinutes() !== minutes
    ? undefined
    : parsed.toISOString();
}

function isMonthFirstLocale(locale?: string): boolean {
  if (!locale) return false;

  const parts = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(2001, 10, 23));
  return parts.filter((part) => part.type === "day" || part.type === "month" || part.type === "year")[0]?.type === "month";
}
