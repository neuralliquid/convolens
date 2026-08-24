import { randomUUID } from 'node:crypto';

import JSZip from 'jszip';

import { logger } from '../utils/logger';

export interface ChatMessage {
  id: string;
  timestamp: Date;
  sender: string;
  content: string;
  isMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  mediaFileName?: string;
  mediaUrl?: string;
}

export interface ChatExportData {
  participants: string[];
  messages: ChatMessage[];
  metadata: {
    exportDate: Date;
    platform: 'whatsapp';
    version: string;
  };
}

// WhatsApp exports use two incompatible on-device formats depending on OS:
//   iOS:     [DD/MM/YYYY, HH:MM:SS] Sender: Message
//   Android: DD/MM/YYYY, HH:MM - Sender: Message  (no brackets, dash separator)
// WhatsApp also sometimes inserts a narrow no-break space (U+202F) instead of
// a regular space before AM/PM. Support both formats and both space kinds.
const IOS_MESSAGE_REGEX =
  /^\[(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s(?<time>\d{1,2}:\d{2}(?::\d{2})?)[\s\u202F]?(?<meridiem>AM|PM)?\]\s(?<sender>.+?):\s(?<content>.+)$/i;
const IOS_SYSTEM_REGEX =
  /^\[(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s(?<time>\d{1,2}:\d{2}(?::\d{2})?)[\s\u202F]?(?<meridiem>AM|PM)?\]\s(?<content>.+)$/i;
const ANDROID_MESSAGE_REGEX =
  /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s(?<time>\d{1,2}:\d{2}(?::\d{2})?)[\s\u202F]?(?<meridiem>AM|PM)?\s-\s(?<sender>.+?):\s(?<content>.+)$/i;
const ANDROID_SYSTEM_REGEX =
  /^(?<date>\d{1,2}\/\d{1,2}\/\d{2,4}),\s(?<time>\d{1,2}:\d{2}(?::\d{2})?)[\s\u202F]?(?<meridiem>AM|PM)?\s-\s(?<content>.+)$/i;

// Media indicator in WhatsApp exports
const MEDIA_INDICATOR = '<Media omitted>';
const ATTACHED_MEDIA_INDICATOR = /^<attached:\s*([^<>]+)>$/i;
const FILE_ATTACHED_INDICATOR = /^(.+\.[a-z0-9]{2,8})\s+\(file attached\)$/i;

type ChatMediaType = NonNullable<ChatMessage['mediaType']>;

function classifyAttachedMedia(fileName: string): ChatMediaType {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension) return 'document';
  if (['opus', 'ogg', 'mp3', 'wav', 'm4a', 'aac', 'flac'].includes(extension)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(extension)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) return 'video';
  return 'document';
}

function attachedMedia(content: string): {
  fileName: string;
  mediaType: ChatMediaType;
} | null {
  const match = ATTACHED_MEDIA_INDICATOR.exec(content) || FILE_ATTACHED_INDICATOR.exec(content);
  const fileName = match?.[1]?.trim();
  if (!fileName) return null;
  return { fileName, mediaType: classifyAttachedMedia(fileName) };
}

// ZIP local-file-header signature ("PK\x03\x04"). Browsers report inconsistent
// (and sometimes generic, e.g. application/octet-stream) MIME types for .zip
// uploads, so the archive is identified by its magic bytes rather than trusted
// metadata.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Whether a buffer looks like a ZIP archive, checked by magic bytes.
 */
export function looksLikeZipArchive(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).equals(ZIP_SIGNATURE);
}

// A crafted (or just pathologically repetitive) small archive can compress
// at ratios far beyond anything a real chat export reaches under DEFLATE, so
// an entry within the 25MB upload cap can still decompress into gigabytes.
// Bound the decompressed size instead of trusting the archive; 100MB mirrors
// the hard ceiling this route file already applies to voice-note uploads.
const MAX_EXTRACTED_TEXT_BYTES = 100 * 1024 * 1024;

export class ZipEntryTooLargeError extends Error {
  constructor(entryName: string, limitBytes: number) {
    super(`Zip entry "${entryName}" exceeds the ${limitBytes}-byte decompressed size limit`);
    this.name = 'ZipEntryTooLargeError';
  }
}

/**
 * Reads a zip entry's decompressed text via JSZip's streaming API, aborting
 * once `maxBytes` is exceeded rather than materializing the full output
 * first (which is what `entry.async('text')` does).
 */
function readZipEntryBounded(entry: JSZip.JSZipObject, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const stream = entry.nodeStream();
    stream.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        stream.removeAllListeners();
        stream.pause();
        reject(new ZipEntryTooLargeError(entry.name, maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

/**
 * Extracts the chat transcript from a WhatsApp "Export chat" .zip archive.
 *
 * WhatsApp's export (with or without media) bundles one chat text file
 * alongside any attached media:
 *   iOS:     _chat.txt
 *   Android: WhatsApp Chat with <name>.txt
 * Either convention is matched by name; if neither is present, the first
 * .txt entry found is used as a fallback so unusual archive layouts still work.
 *
 * @returns the transcript text, or null if the archive opened fine but has
 *   no .txt entry. Rejects (does not resolve null) if the archive itself
 *   can't be read — corrupt data, or a single entry whose decompressed size
 *   exceeds `maxBytes` — since callers generally want to tell "no transcript
 *   in an otherwise valid export" apart from "couldn't read this upload at
 *   all".
 *
 * @param maxBytes decompressed-size cap, exposed mainly so tests can exercise
 *   the cap against small fixtures instead of real oversized archives.
 *   Defaults to {@link MAX_EXTRACTED_TEXT_BYTES}.
 */
export async function extractChatTextFromZip(
  buffer: Buffer,
  maxBytes: number = MAX_EXTRACTED_TEXT_BYTES
): Promise<string | null> {
  const zip = await JSZip.loadAsync(buffer);
  const txtEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.toLowerCase().endsWith('.txt')
  );
  if (txtEntries.length === 0) return null;

  const preferred =
    txtEntries.find((entry) => /(?:^|\/)_chat\.txt$/i.test(entry.name)) ||
    txtEntries.find((entry) => /(?:^|\/)WhatsApp Chat with .+\.txt$/i.test(entry.name)) ||
    txtEntries[0];

  return readZipEntryBounded(preferred, maxBytes);
}

/**
 * Parses a WhatsApp chat export file content into structured data
 * @param fileContent The raw text content of the WhatsApp export file
 * @returns Parsed chat data
 */
export async function parseWhatsAppExport(fileContent: string): Promise<ChatExportData> {
  try {
    const lines = fileContent.split(/\r?\n/).filter((line) => line.trim() !== '');
    const participants = new Set<string>();
    const messages: ChatMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const messageMatch = IOS_MESSAGE_REGEX.exec(line) || ANDROID_MESSAGE_REGEX.exec(line);
      const systemMatch = messageMatch
        ? null
        : IOS_SYSTEM_REGEX.exec(line) || ANDROID_SYSTEM_REGEX.exec(line);
      if (!messageMatch && !systemMatch) {
        logger.warn(`Skipping malformed line: ${line}`);
        continue;
      }

      // A timestamp followed by an empty sender ("... ] : message") also
      // matches the broader system-message format. Keep it malformed instead
      // of persisting it as a message from System.
      if (systemMatch?.groups!.content.trimStart().startsWith(':')) {
        logger.warn(`Skipping malformed line with empty sender: ${line}`);
        continue;
      }

      try {
        const groups = (messageMatch || systemMatch)!.groups!;
        const dateStr = groups.date;
        const timeStr = groups.time;
        const meridiem = groups.meridiem?.toLowerCase();
        const sender = messageMatch?.groups!.sender || 'System';
        const content = messageMatch?.groups!.content || systemMatch!.groups!.content;
        const isSystemMessage = Boolean(systemMatch);

        // Parse date and time
        const [day, month, year] = dateStr.split('/').map(Number);
        const yearFull = year < 100 ? 2000 + year : year; // Handle YY vs YYYY

        // Parse time (handle both HH:MM and HH:MM:SS formats)
        const [hours, minutes, seconds = '0'] = timeStr.split(':');

        // Adjust for AM/PM if present (case-insensitive)
        let hours24 = parseInt(hours, 10);
        if (meridiem === 'pm' && hours24 < 12) hours24 += 12;
        if (meridiem === 'am' && hours24 === 12) hours24 = 0;

        const timestamp = new Date(
          yearFull,
          month - 1,
          day,
          hours24,
          parseInt(minutes, 10),
          parseInt(seconds, 10)
        );

        if (isNaN(timestamp.getTime())) {
          logger.warn(`Invalid timestamp in line: ${line}`);
          continue;
        }

        const trimmedSender = sender.trim();
        if (!trimmedSender) {
          logger.warn(`Empty sender in line: ${line}`);
          continue;
        }

        const trimmedContent = content.trim();
        const attachment = attachedMedia(trimmedContent);
        const isMedia = trimmedContent === MEDIA_INDICATOR || Boolean(attachment);

        // Add sender to participants if it's not a system message
        if (!isSystemMessage) {
          participants.add(trimmedSender);
        }

        // Add the message
        messages.push({
          id: randomUUID(),
          timestamp,
          sender: isSystemMessage ? 'System' : trimmedSender,
          content: trimmedContent,
          isMedia,
          mediaType: attachment?.mediaType,
          mediaFileName: attachment?.fileName,
          mediaUrl: isMedia ? undefined : undefined,
        });
      } catch (error) {
        logger.warn(`Error processing line: ${line}`, error);
        continue;
      }
    }

    // Sort messages by timestamp
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      participants: Array.from(participants).sort(),
      messages,
      metadata: {
        exportDate: new Date(),
        platform: 'whatsapp',
        version: '1.0.0',
      },
    };
  } catch (error) {
    logger.error('Error parsing WhatsApp export:', error);
    throw new Error('Failed to parse WhatsApp export');
  }
}

/**
 * Validates if the content is a valid WhatsApp chat export
 * @param content The file content to validate
 * @returns boolean indicating if the content is valid
 */
export function isValidWhatsAppExport(content: string): boolean {
  // Check for common WhatsApp export patterns. iOS wraps the timestamp in
  // brackets; Android leaves it bare with a trailing " - " instead — the two
  // platforms produce incompatible export files, so both must be checked.
  const patterns = [
    /^\[\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}(?::\d{2})?[\s\u202F]?(?:AM|PM)?\] [^:]+: /im, // iOS message
    /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}(?::\d{2})?[\s\u202F]?(?:AM|PM)? - [^:]+: /im, // Android message
    /^WhatsApp Chat with .+$/im, // Header
    /^Messages and calls are end-to-end encrypted/im, // Footer (iOS)
    /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}(?::\d{2})?[\s\u202F]?(?:AM|PM)? - Messages and calls are end-to-end encrypted/im, // Footer (Android)
  ];

  // Check if any of the patterns match
  return patterns.some((pattern) => pattern.test(content));
}
