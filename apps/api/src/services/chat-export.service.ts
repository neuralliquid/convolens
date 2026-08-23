import { randomUUID } from 'node:crypto';

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

// Regular expression to match WhatsApp message format:
// [DD/MM/YYYY, HH:MM:SS] Sender: Message
const MESSAGE_REGEX =
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?)\s?(AM|PM)?\]\s(.+?):\s(.+)$/i;

// Alternative format for system messages
const SYSTEM_MESSAGE_REGEX =
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?)\s?(AM|PM)?\]\s(.+)$/i;

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

      const messageMatch = MESSAGE_REGEX.exec(line);
      const systemMatch = messageMatch ? null : SYSTEM_MESSAGE_REGEX.exec(line);
      if (!messageMatch && !systemMatch) {
        logger.warn(`Skipping malformed line: ${line}`);
        continue;
      }

      // A timestamp followed by an empty sender ("... ] : message") also
      // matches the broader system-message format. Keep it malformed instead
      // of persisting it as a message from System.
      if (systemMatch?.[4].trimStart().startsWith(':')) {
        logger.warn(`Skipping malformed line with empty sender: ${line}`);
        continue;
      }

      try {
        const dateStr = (messageMatch || systemMatch)![1];
        const timeStr = (messageMatch || systemMatch)![2];
        const meridiem = (messageMatch || systemMatch)![3]?.toLowerCase();
        const sender = messageMatch?.[4] || 'System';
        const content = messageMatch?.[5] || systemMatch![4];
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
  // Check for common WhatsApp export patterns
  const patterns = [
    /^\[\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?\] [^:]+: /im, // Standard message
    /^WhatsApp Chat with .+$/im, // Header
    /^Messages and calls are end-to-end encrypted/im, // Footer
  ];

  // Check if any of the patterns match
  return patterns.some((pattern) => pattern.test(content));
}
