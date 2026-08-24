import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import JSZip from 'jszip';

import {
  parseWhatsAppExport,
  looksLikeZipArchive,
  extractChatTextFromZip,
} from '../chat-export.service';
import type { ChatExportData } from '../chat-export.service';

describe('ChatExportService', () => {
  describe('parseWhatsAppExport', () => {
    it('should parse a simple WhatsApp export', async () => {
      const chatContent = `
[08/01/2023, 10:30:00] John Doe: Hello, how are you?
[08/01/2023, 10:31:15] Jane Smith: I'm good, thanks! How about you?
[08/01/2023, 10:32:30] John Doe: Doing well, thanks for asking!
      `;

      const result = await parseWhatsAppExport(chatContent);

      expect(result).toBeDefined();
      expect(result.participants).toContain('John Doe');
      expect(result.participants).toContain('Jane Smith');
      expect(result.messages).toHaveLength(3);

      const firstMessage = result.messages[0];
      expect(firstMessage.sender).toBe('John Doe');
      expect(firstMessage.content).toBe('Hello, how are you?');
      expect(firstMessage.timestamp).toBeInstanceOf(Date);

      const secondMessage = result.messages[1];
      expect(secondMessage.sender).toBe('Jane Smith');
      expect(secondMessage.content).toBe("I'm good, thanks! How about you?");

      // Verify metadata
      expect(result.metadata).toBeDefined();
      expect(result.metadata.exportDate).toBeInstanceOf(Date);
      expect(result.metadata.platform).toBe('whatsapp');
    });

    it('should handle empty content', async () => {
      const result = await parseWhatsAppExport('');

      expect(result).toBeDefined();
      expect(result.participants).toHaveLength(0);
      expect(result.messages).toHaveLength(0);
    });

    it('should handle malformed lines', async () => {
      const chatContent = `
This is not a valid line
[Invalid Date Format] John Doe: This line will be skipped
[08/01/2023, 10:30:00] : Message with missing sender
[08/01/2023, 10:31:00]    : Message with a whitespace-only sender
      `;

      const result = await parseWhatsAppExport(chatContent);

      expect(result).toBeDefined();
      expect(result.messages).toHaveLength(0);
    });

    it('should handle media messages', async () => {
      const chatContent = `
[08/01/2023, 10:30:00] John Doe: <Media omitted>
[08/01/2023, 10:31:00] Jane Smith: Here's a photo!
      `;

      const result = await parseWhatsAppExport(chatContent);

      expect(result.messages[0].isMedia).toBe(true);
      expect(result.messages[1].isMedia).toBe(false);
    });

    it('classifies iOS attached Opus voice notes without discarding the attachment name', async () => {
      const chatContent = `
[08/01/2023, 10:30:00] John Doe: <attached: 00000002-AUDIO-20230108-WA0001.opus>
      `;

      const result = await parseWhatsAppExport(chatContent);

      expect(result.messages[0]).toMatchObject({
        content: '<attached: 00000002-AUDIO-20230108-WA0001.opus>',
        isMedia: true,
        mediaType: 'audio',
        mediaFileName: '00000002-AUDIO-20230108-WA0001.opus',
      });
    });

    it('classifies the alternate file-attached voice-note marker', async () => {
      const result = await parseWhatsAppExport(
        '[08/01/2023, 10:30:00] Jane Smith: PTT-20230108-WA0002.ogg (file attached)'
      );

      expect(result.messages[0]).toMatchObject({
        isMedia: true,
        mediaType: 'audio',
        mediaFileName: 'PTT-20230108-WA0002.ogg',
      });
    });

    it('should parse Windows CRLF exports', async () => {
      const chatContent =
        '[25/07/2026, 09:00:00] Hans: First message\r\n' +
        '[25/07/2026, 09:01:00] Irma: Second message\r\n';

      const result = await parseWhatsAppExport(chatContent);

      expect(result.messages).toHaveLength(2);
      expect(result.participants).toEqual(['Hans', 'Irma']);
    });

    it('should preserve system messages and parse 12-hour timestamps', async () => {
      const chatContent = `
[25/07/2026, 12:30:00] Hans: Twenty-four-hour noon
[25/07/2026, 01:15:00 PM] Irma: Afternoon message
[25/07/2026, 01:16:00 PM] Messages are end-to-end encrypted
      `;

      const result = await parseWhatsAppExport(chatContent);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0].timestamp.getHours()).toBe(12);
      expect(result.messages[1].timestamp.getHours()).toBe(13);
      expect(result.messages[2]).toMatchObject({
        sender: 'System',
        content: 'Messages are end-to-end encrypted',
      });
    });
  });

  describe('looksLikeZipArchive', () => {
    it('recognizes a ZIP archive by its magic bytes', () => {
      expect(looksLikeZipArchive(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe(true);
    });

    it('rejects plain text content', () => {
      expect(looksLikeZipArchive(Buffer.from('[25/07/2026, 12:30:00] Hans: hi'))).toBe(false);
    });
  });

  describe('extractChatTextFromZip', () => {
    it('extracts an iOS-style _chat.txt entry', async () => {
      const zip = new JSZip();
      zip.file('_chat.txt', '[25/07/2026, 12:30:00] Hans: hi from ios export');
      zip.file('IMG-20260725-WA0001.jpg', Buffer.from([0xff, 0xd8]));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const text = await extractChatTextFromZip(buffer);

      expect(text).toBe('[25/07/2026, 12:30:00] Hans: hi from ios export');
    });

    it('extracts an Android-style "WhatsApp Chat with <name>.txt" entry', async () => {
      const zip = new JSZip();
      zip.file('WhatsApp Chat with Irma.txt', '25/07/2026, 12:30 - Hans: hi from android export');
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const text = await extractChatTextFromZip(buffer);

      expect(text).toBe('25/07/2026, 12:30 - Hans: hi from android export');
    });

    it('falls back to the first .txt entry when neither naming convention matches', async () => {
      const zip = new JSZip();
      zip.file('transcript.txt', 'fallback content');
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const text = await extractChatTextFromZip(buffer);

      expect(text).toBe('fallback content');
    });

    it('returns null when the archive has no .txt entry', async () => {
      const zip = new JSZip();
      zip.file('IMG-20260725-WA0001.jpg', Buffer.from([0xff, 0xd8]));
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      const text = await extractChatTextFromZip(buffer);

      expect(text).toBeNull();
    });
  });
});
