/**
 * Selector Service
 *
 * Manages WhatsApp Web DOM selectors with auto-update capability.
 * Supports remote selector updates when WhatsApp changes their DOM structure.
 *
 * Features:
 * - Remote selector updates from API
 * - Local fallback selectors
 * - Selector validation (test if selectors work)
 * - Automatic selector discovery using heuristics
 * - Caching with periodic refresh
 */

import { SELECTORS, getConfig, STORAGE_KEYS } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface SelectorSet {
  chatList: string;
  messageList: string;
  messageContainer: string;
  messageText: string;
  messageTime: string;
  senderName: string;
  chatHeader: string;
  contactName: string;
  scrollableMessageList: string;
}

export interface SelectorConfig {
  version: string;
  updatedAt: string;
  primary: SelectorSet;
  fallback: SelectorSet;
  discovery: DiscoveryRules;
}

export interface DiscoveryRules {
  // Patterns to help discover selectors automatically
  messageContainerPatterns: string[];
  textContentPatterns: string[];
  timestampPatterns: string[];
}

interface CachedSelectors {
  config: SelectorConfig;
  cachedAt: number;
  validatedAt: number;
}

// =============================================================================
// Constants
// =============================================================================

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VALIDATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Default discovery rules for auto-finding selectors
const DEFAULT_DISCOVERY_RULES: DiscoveryRules = {
  messageContainerPatterns: [
    '[data-testid*="msg"]',
    '[class*="message"]',
    '[role="row"]',
  ],
  textContentPatterns: [
    '[data-testid="msg-text"]',
    '.selectable-text',
    '[dir="ltr"]',
  ],
  timestampPatterns: [
    '[data-testid*="meta"]',
    '[data-testid*="time"]',
    'span[dir="auto"]',
  ],
};

// =============================================================================
// Selector Service
// =============================================================================

class SelectorService {
  private currentConfig: SelectorConfig;
  private cachedSelectors: CachedSelectors | null = null;
  private isRefreshing: boolean = false;
  private lastValidation: number = 0;

  constructor() {
    // Initialize with built-in selectors
    this.currentConfig = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      primary: SELECTORS.primary as SelectorSet,
      fallback: SELECTORS.fallback as SelectorSet,
      discovery: DEFAULT_DISCOVERY_RULES,
    };

    // Load cached selectors
    this.loadCachedSelectors();
  }

  /**
   * Get the best selector for a given element type
   */
  getSelector(key: keyof SelectorSet): { primary: string; fallback: string } {
    return {
      primary: this.currentConfig.primary[key],
      fallback: this.currentConfig.fallback[key],
    };
  }

  /**
   * Query for an element using primary then fallback selector
   */
  querySelector(key: keyof SelectorSet): Element | null {
    const { primary, fallback } = this.getSelector(key);
    return document.querySelector(primary) || document.querySelector(fallback);
  }

  /**
   * Query for all elements using primary then fallback selector
   */
  querySelectorAll(key: keyof SelectorSet): NodeListOf<Element> {
    const { primary, fallback } = this.getSelector(key);
    const primaryResults = document.querySelectorAll(primary);

    if (primaryResults.length > 0) {
      return primaryResults;
    }

    return document.querySelectorAll(fallback);
  }

  /**
   * Refresh selectors from remote API
   */
  async refreshSelectors(force: boolean = false): Promise<boolean> {
    // Check cache TTL
    if (!force && this.cachedSelectors) {
      const age = Date.now() - this.cachedSelectors.cachedAt;
      if (age < CACHE_TTL_MS) {
        console.log('[SelectorService] Using cached selectors');
        return true;
      }
    }

    if (this.isRefreshing) {
      console.log('[SelectorService] Refresh already in progress');
      return false;
    }

    this.isRefreshing = true;

    try {
      const config = getConfig();
      const response = await fetch(`${config.apiUrl}/api/extension/selectors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Version': chrome.runtime.getManifest().version,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch selectors: ${response.status}`);
      }

      const data = await response.json();

      if (data.selectors) {
        this.updateSelectors(data.selectors);
        console.log('[SelectorService] Selectors updated to version', data.selectors.version);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[SelectorService] Failed to refresh selectors:', error);
      // Fall back to built-in selectors
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Validate that selectors are working
   */
  async validateSelectors(): Promise<{
    isValid: boolean;
    workingSelectors: string[];
    brokenSelectors: string[];
  }> {
    const now = Date.now();

    // Don't validate too frequently
    if (now - this.lastValidation < VALIDATION_INTERVAL_MS) {
      return { isValid: true, workingSelectors: [], brokenSelectors: [] };
    }

    this.lastValidation = now;

    const workingSelectors: string[] = [];
    const brokenSelectors: string[] = [];

    // Key selectors that must work
    const criticalSelectors: (keyof SelectorSet)[] = [
      'messageList',
      'messageContainer',
      'messageText',
    ];

    for (const key of criticalSelectors) {
      const element = this.querySelector(key);
      if (element) {
        workingSelectors.push(key);
      } else {
        brokenSelectors.push(key);
      }
    }

    const isValid = brokenSelectors.length === 0;

    if (!isValid) {
      console.warn('[SelectorService] Broken selectors detected:', brokenSelectors);
      // Try to discover working selectors
      await this.discoverSelectors();
    }

    if (this.cachedSelectors) {
      this.cachedSelectors.validatedAt = now;
      await this.saveCachedSelectors();
    }

    return { isValid, workingSelectors, brokenSelectors };
  }

  /**
   * Attempt to discover working selectors using heuristics
   */
  async discoverSelectors(): Promise<Partial<SelectorSet>> {
    console.log('[SelectorService] Attempting selector discovery...');

    const discovered: Partial<SelectorSet> = {};

    // Try to find message container
    for (const pattern of this.currentConfig.discovery.messageContainerPatterns) {
      const elements = document.querySelectorAll(pattern);
      if (elements.length > 5) { // Messages should have multiple instances
        discovered.messageContainer = pattern;
        console.log('[SelectorService] Discovered messageContainer:', pattern);
        break;
      }
    }

    // Try to find text content within messages
    if (discovered.messageContainer) {
      const container = document.querySelector(discovered.messageContainer);
      if (container) {
        for (const pattern of this.currentConfig.discovery.textContentPatterns) {
          const textEl = container.querySelector(pattern);
          if (textEl?.textContent && textEl.textContent.length > 0) {
            discovered.messageText = pattern;
            console.log('[SelectorService] Discovered messageText:', pattern);
            break;
          }
        }
      }
    }

    // Report discovered selectors to the server for analysis
    if (Object.keys(discovered).length > 0) {
      await this.reportDiscoveredSelectors(discovered);
    }

    return discovered;
  }

  /**
   * Report discovered selectors to the server
   */
  private async reportDiscoveredSelectors(discovered: Partial<SelectorSet>): Promise<void> {
    try {
      const config = getConfig();
      await fetch(`${config.apiUrl}/api/extension/selectors/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Version': chrome.runtime.getManifest().version,
        },
        body: JSON.stringify({
          discovered,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });
      console.log('[SelectorService] Reported discovered selectors');
    } catch (error) {
      // Silent fail - this is just for telemetry
    }
  }

  /**
   * Update selectors with new config
   */
  private updateSelectors(config: SelectorConfig): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...config,
    };

    this.cachedSelectors = {
      config: this.currentConfig,
      cachedAt: Date.now(),
      validatedAt: 0,
    };

    this.saveCachedSelectors();
  }

  /**
   * Load cached selectors from storage
   */
  private async loadCachedSelectors(): Promise<void> {
    try {
      const stored = await chrome.storage.local.get(['selectorCache']);
      if (stored.selectorCache) {
        this.cachedSelectors = stored.selectorCache;

        // Check if cache is still valid
        const age = Date.now() - this.cachedSelectors.cachedAt;
        if (age < CACHE_TTL_MS) {
          this.currentConfig = this.cachedSelectors.config;
          console.log('[SelectorService] Loaded cached selectors version', this.currentConfig.version);
        }
      }
    } catch (error) {
      console.warn('[SelectorService] Failed to load cached selectors:', error);
    }
  }

  /**
   * Save selectors to storage
   */
  private async saveCachedSelectors(): Promise<void> {
    try {
      await chrome.storage.local.set({
        selectorCache: this.cachedSelectors,
      });
    } catch (error) {
      console.warn('[SelectorService] Failed to save cached selectors:', error);
    }
  }

  /**
   * Get current selector version
   */
  getVersion(): string {
    return this.currentConfig.version;
  }

  /**
   * Get all current selectors
   */
  getAllSelectors(): SelectorConfig {
    return { ...this.currentConfig };
  }

  /**
   * Manually set a selector (for testing/debugging)
   */
  setSelector(key: keyof SelectorSet, type: 'primary' | 'fallback', value: string): void {
    this.currentConfig[type][key] = value;
    console.log(`[SelectorService] Set ${type}.${key} = "${value}"`);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const selectorService = new SelectorService();

export default selectorService;
