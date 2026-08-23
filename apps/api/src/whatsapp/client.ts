import { Browser, Page, launch } from 'puppeteer';
import * as qrcode from 'qrcode-terminal';
import { Server as SocketIOServer } from 'socket.io';

import { logger } from '../utils/logger';

export interface WhatsAppClient {
  initialize(): Promise<void>;
  monitorGroup(groupName: string): Promise<void>;
  cleanup(): Promise<void>;
  // Add any other methods that are used by the client
}

export function createWhatsAppClient(io: SocketIOServer): WhatsAppClient {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let isAuthenticated = false;
  const monitoredGroups = new Set<string>();

  const initialize = async (): Promise<void> => {
    try {
      browser = await launch({
        headless: false, // Set to true in production
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      await page.goto('https://web.whatsapp.com');
      logger.info('WhatsApp Web opened');

      // Wait for QR code scan
      await page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 0 });
      logger.info('Please scan the QR code with your phone');

      // Get QR code data
      const qrData = await page.evaluate(() => {
        const qrElement = document.querySelector('canvas[aria-label="Scan me!"]');
        return qrElement ? qrElement.parentElement?.getAttribute('data-ref') : null;
      });

      if (qrData) {
        qrcode.generate(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`, {
          small: true,
        });

        // Notify frontend about QR code
        io.emit('qr', { qr: qrData });
      }

      // Wait for authentication
      await page.waitForSelector('div[data-testid="chat-list"]', { timeout: 0 });
      isAuthenticated = true;
      io.emit('authenticated');
      logger.info('Successfully authenticated with WhatsApp Web');
    } catch (error) {
      logger.error('Error initializing WhatsApp client:', error);
      throw error;
    }
  };

  const monitorGroup = async (groupName: string): Promise<void> => {
    if (!page || !isAuthenticated) {
      throw new Error('WhatsApp client not initialized or authenticated');
    }

    if (monitoredGroups.has(groupName)) {
      logger.info(`Already monitoring group: ${groupName}`);
      return;
    }

    try {
      // Navigate to the group chat
      await page.goto(`https://web.whatsapp.com/accept?code=${encodeURIComponent(groupName)}`);

      // Wait for the chat to load
      await page.waitForSelector('div[data-testid="conversation-panel-wrapper"]');

      logger.info(`Now monitoring group: ${groupName}`);
      monitoredGroups.add(groupName);

      // Set up message listener
      await page.exposeFunction('onNewMessage', (message: any) => {
        io.emit('newMessage', { groupName, message });
      });

      // Listen for new messages
      await page.evaluate(() => {
        const targetNode = document.querySelector('div[data-testid="conversation-panel-body"]');
        if (targetNode) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.addedNodes.length) {
                // @ts-expect-error - onNewMessage is exposed via exposeFunction
                window.onNewMessage({
                  timestamp: new Date().toISOString(),
                  content: mutation.addedNodes[0].textContent,
                  // Add more message details as needed
                });
              }
            });
          });

          observer.observe(targetNode, {
            childList: true,
            subtree: true,
          });
        }
      });
    } catch (error) {
      logger.error(`Error monitoring group ${groupName}:`, error);
      throw error;
    }
  };

  const cleanup = async (): Promise<void> => {
    if (browser) {
      await browser.close();
      browser = null;
      page = null;
      isAuthenticated = false;
      monitoredGroups.clear();
      logger.info('WhatsApp client cleaned up');
    }
  };

  return {
    initialize,
    monitorGroup,
    cleanup,
  };
}
