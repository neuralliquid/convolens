import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  timestamp: Date;
  sender: string;
  content: string;
  isMedia: boolean;
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
const MESSAGE_REGEX = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?)\s?(?:AM|PM)?\]\s(.+?):\s(.+)$/i;

// Alternative format for system messages
const SYSTEM_MESSAGE_REGEX = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?)\s?(?:AM|PM)?\]\s(.+)$/i;

// Media indicator in WhatsApp exports
const MEDIA_INDICATOR = '<Media omitted>';

/**
 * Parses a WhatsApp chat export file content into structured data
 * @param fileContent The raw text content of the WhatsApp export file
 * @returns Parsed chat data
 */
export async function parseWhatsAppExport(
  fileContent: string
): Promise<ChatExportData> {
  try {
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const participants = new Set<string>();
    const messages: ChatMessage[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      let match = MESSAGE_REGEX.exec(line);
      let isSystemMessage = false;

      if (!match) {
        // Try matching system message format
        const systemMatch = SYSTEM_MESSAGE_REGEX.exec(line);
        if (systemMatch) {
          isSystemMessage = true;
          match = systemMatch;
        } else {
          logger.warn(`Skipping malformed line: ${line}`);
          continue;
        }
      }

      try {
        const [_, dateStr, timeStr, sender, content] = match;

        // Parse date and time
        const [day, month, year] = dateStr.split('/').map(Number);
        const yearFull = year < 100 ? 2000 + year : year; // Handle YY vs YYYY

        // Parse time (handle both HH:MM and HH:MM:SS formats)
        const [hours, minutes, seconds = '0'] = timeStr.split(':');

        // Adjust for AM/PM if present (case-insensitive)
        let hours24 = parseInt(hours, 10);
        const isPM = timeStr.toLowerCase().includes('pm');
        if (isPM && hours24 < 12) hours24 += 12;
        if (!isPM && hours24 === 12) hours24 = 0;

        const timestamp = new Date(yearFull, month - 1, day, hours24, parseInt(minutes, 10), parseInt(seconds, 10));

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
        const isMedia = trimmedContent === MEDIA_INDICATOR;

        // Add sender to participants if it's not a system message
        if (!isSystemMessage) {
          participants.add(trimmedSender);
        }

        // Add the message
        messages.push({
          id: uuidv4(),
          timestamp,
          sender: isSystemMessage ? 'System' : trimmedSender,
          content: isMedia ? MEDIA_INDICATOR : trimmedContent,
          isMedia,
          mediaUrl: isMedia ? undefined : undefined
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
        version: '1.0.0'
      }
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
  return patterns.some(pattern => pattern.test(content));
}
