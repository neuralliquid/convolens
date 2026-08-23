import { EventEmitter } from 'events';

import { Browser, Page, launch } from 'puppeteer';
import * as qrcode from 'qrcode-terminal';
import { Server as SocketIOServer } from 'socket.io';

import { WhatsAppClient, WhatsAppMessage } from '../types/whatsapp.types';
import { logger } from '../utils/logger';

class WhatsAppServiceImpl extends EventEmitter implements WhatsAppClient {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isAuthenticated = false;
  private monitoredGroups = new Set<string>();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    super();
    this.io = io;
  }

  async initialize(): Promise<void> {
    try {
      this.browser = await launch({
        headless: process.env.NODE_ENV !== 'development',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      await this.page.goto('https://web.whatsapp.com');
      logger.info('WhatsApp Web opened');

      // Wait for QR code scan
      await this.page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 0 });
      logger.info('Please scan the QR code with your phone');

      // Get QR code data
      const qrData = await this.page.evaluate(() => {
        const qrElement = document.querySelector('canvas[aria-label="Scan me!"]');
        return qrElement ? qrElement.parentElement?.getAttribute('data-ref') : null;
      });

      if (qrData) {
        qrcode.generate(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}`, {
          small: true,
        });
        this.io.emit('qr', { qr: qrData });
      }

      // Wait for authentication
      await this.page.waitForSelector('div[data-testid="chat-list"]', { timeout: 0 });
      this.isAuthenticated = true;
      this.io.emit('authenticated');
      logger.info('Successfully authenticated with WhatsApp Web');

      // Listen for new messages
      await this.setupMessageListener();
    } catch (error) {
      logger.error('Error initializing WhatsApp client:', error);
      throw error;
    }
  }

  async monitorGroup(groupName: string): Promise<void> {
    if (!this.page || !this.isAuthenticated) {
      throw new Error('WhatsApp client not initialized or authenticated');
    }

    if (this.monitoredGroups.has(groupName)) {
      logger.info(`Already monitoring group: ${groupName}`);
      return;
    }

    try {
      // Navigate to the group chat
      await this.page.goto(`https://web.whatsapp.com/accept?code=${encodeURIComponent(groupName)}`);

      // Wait for the chat to load
      await this.page.waitForSelector('div[data-testid="conversation-panel-wrapper"]');

      logger.info(`Now monitoring group: ${groupName}`);
      this.monitoredGroups.add(groupName);
    } catch (error) {
      logger.error(`Error monitoring group ${groupName}:`, error);
      throw error;
    }
  }

  private async setupMessageListener() {
    if (!this.page) return;

    // Expose a function to be called from the page context
    await this.page.exposeFunction('onNewMessage', (message: WhatsAppMessage) => {
      this.emit('message', message);
      this.io.emit('message', message);
    });

    // Listen for new messages
    await this.page.evaluate(() => {
      const targetNode = document.querySelector('div[data-testid="conversation-panel-body"]');
      if (!targetNode) return;

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length) {
            const messageNode = mutation.addedNodes[0] as HTMLElement;
            const messageText = messageNode.textContent || '';

            // @ts-expect-error - onNewMessage is exposed via exposeFunction
            window.onNewMessage({
              id: messageNode.getAttribute('data-id') || Date.now().toString(),
              content: messageText,
              sender: messageNode.getAttribute('data-sender') || 'Unknown',
              timestamp: new Date(),
              isMedia: messageNode.querySelector('img, video') !== null,
              mediaUrl: messageNode.querySelector('img, video')?.getAttribute('src') || undefined,
            });
          }
        });
      });

      observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });
    });
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isAuthenticated = false;
      this.monitoredGroups.clear();
      logger.info('WhatsApp client cleaned up');
    }
  }
}

export const createWhatsAppClient = (io: SocketIOServer): WhatsAppClient => {
  return new WhatsAppServiceImpl(io);
};
