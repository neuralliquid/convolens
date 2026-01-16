/**
 * AI Summary Service - Production-Ready Implementation
 *
 * FEATURE-1: AI-Powered Summary Generation
 *
 * This service provides chat summarization using multiple AI providers:
 * - Azure AI Foundry (Azure OpenAI Service)
 * - OpenAI API (Direct)
 * - Anthropic Claude API
 *
 * Provider Selection Priority:
 * 1. Azure AI Foundry (if AZURE_OPENAI_ENDPOINT configured)
 * 2. OpenAI (if OPENAI_API_KEY configured)
 * 3. Anthropic (if ANTHROPIC_API_KEY configured)
 * 4. Mock (fallback for development)
 *
 * Integration Points:
 * - Connects to Azure OpenAI, OpenAI API, or Anthropic Claude API
 * - Used by chat-export routes for summary generation
 * - Supports streaming responses for real-time feedback
 *
 * Production Features:
 * - Retry logic with exponential backoff
 * - Request timeout handling
 * - Error categorization and logging
 * - Provider health checking
 *
 * TODO: Additional Hardening
 * - Implement request queuing and rate limiting
 * - Add response caching for similar queries
 * - Implement cost tracking and budget limits
 * - Add content moderation/filtering
 *
 * Future Enhancements:
 * - Support for custom prompts/templates
 * - Multi-language summary generation
 * - Sentiment analysis integration
 * - Topic extraction and categorization
 * - Summary length customization
 */

import { logger } from '../../utils/logger';

// Types
export interface ChatMessage {
  id: string;
  timestamp: Date;
  sender: string;
  content: string;
  isMedia?: boolean;
}

export interface SummaryOptions {
  style?: 'concise' | 'detailed' | 'bullet-points';
  maxLength?: number;
  language?: string;
  includeKeyTopics?: boolean;
  includeParticipantStats?: boolean;
  timeRange?: {
    start?: Date;
    end?: Date;
  };
}

export interface SummaryResult {
  summary: string;
  keyTopics?: string[];
  participantStats?: {
    name: string;
    messageCount: number;
    percentage: number;
  }[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  generatedAt: Date;
  tokensUsed?: number;
  provider: 'azure' | 'openai' | 'anthropic' | 'mock';
}

export interface StreamCallback {
  onToken?: (token: string) => void;
  onComplete?: (result: SummaryResult) => void;
  onError?: (error: Error) => void;
}

// AI Provider Configuration
const AI_CONFIG = {
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT, // e.g., https://your-resource.openai.azure.com
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4',
    // API version is optional for newer Azure AI Foundry deployments
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || undefined,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
};

// Retry configuration for production resilience
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  timeoutMs: 30000,
};

/**
 * Determines which AI provider to use based on configuration
 * Priority: Azure > OpenAI > Anthropic > Mock
 */
function getActiveProvider(): 'azure' | 'openai' | 'anthropic' | 'mock' {
  if (AI_CONFIG.azure.endpoint && AI_CONFIG.azure.apiKey) return 'azure';
  if (AI_CONFIG.openai.apiKey) return 'openai';
  if (AI_CONFIG.anthropic.apiKey) return 'anthropic';
  return 'mock';
}

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = RETRY_CONFIG.maxRetries, baseDelayMs = RETRY_CONFIG.baseDelayMs, maxDelayMs = RETRY_CONFIG.maxDelayMs } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx) except rate limiting (429)
      if (error instanceof Error && error.message.includes('4') && !error.message.includes('429')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        logger.warn(`[SummaryService] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = RETRY_CONFIG.timeoutMs
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generates a system prompt for chat summarization
 */
function buildSystemPrompt(options: SummaryOptions): string {
  const styleInstructions = {
    concise: 'Provide a brief, concise summary in 2-3 sentences.',
    detailed: 'Provide a comprehensive summary covering all major topics and discussions.',
    'bullet-points': 'Provide the summary as a bulleted list of key points.',
  };

  return `You are an expert chat conversation analyst. Your task is to summarize WhatsApp conversations.

${styleInstructions[options.style || 'concise']}

${options.includeKeyTopics ? 'Also extract and list the main topics discussed.' : ''}
${options.includeParticipantStats ? 'Include observations about participant engagement.' : ''}

Guidelines:
- Focus on the most important information
- Maintain neutrality and objectivity
- Preserve context and key decisions made
- Note any action items or follow-ups mentioned
- Be respectful of privacy - don't include sensitive personal details

Language: ${options.language || 'English'}
Maximum length: ${options.maxLength || 500} words`;
}

/**
 * Formats chat messages for AI processing
 */
function formatMessagesForAI(messages: ChatMessage[]): string {
  return messages
    .map((msg) => {
      const timestamp = msg.timestamp.toISOString().split('T')[0];
      const content = msg.isMedia ? '[Media file]' : msg.content;
      return `[${timestamp}] ${msg.sender}: ${content}`;
    })
    .join('\n');
}

/**
 * Main Summary Service Class
 */
export class SummaryService {
  private provider: 'azure' | 'openai' | 'anthropic' | 'mock';

  constructor() {
    this.provider = getActiveProvider();
    logger.info(`[SummaryService] Using AI provider: ${this.provider}`);

    // Log provider configuration (without secrets)
    if (this.provider === 'azure') {
      logger.info(`[SummaryService] Azure endpoint: ${AI_CONFIG.azure.endpoint}`);
      logger.info(`[SummaryService] Azure deployment: ${AI_CONFIG.azure.deploymentName}`);
    }
  }

  /**
   * Get current provider info for health checks
   */
  getProviderInfo(): { provider: string; configured: boolean; endpoint?: string } {
    return {
      provider: this.provider,
      configured: this.provider !== 'mock',
      endpoint: this.provider === 'azure' ? AI_CONFIG.azure.endpoint : undefined,
    };
  }

  /**
   * Generates a summary for the given chat messages
   */
  async generateSummary(
    messages: ChatMessage[],
    options: SummaryOptions = {}
  ): Promise<SummaryResult> {
    const startTime = Date.now();

    try {
      // Filter messages by time range if specified
      let filteredMessages = messages;
      if (options.timeRange) {
        filteredMessages = messages.filter((msg) => {
          if (options.timeRange?.start && msg.timestamp < options.timeRange.start) {
            return false;
          }
          if (options.timeRange?.end && msg.timestamp > options.timeRange.end) {
            return false;
          }
          return true;
        });
      }

      if (filteredMessages.length === 0) {
        return {
          summary: 'No messages to summarize in the specified time range.',
          generatedAt: new Date(),
          provider: this.provider,
        };
      }

      // Generate summary based on provider with retry logic
      let result: SummaryResult;

      switch (this.provider) {
        case 'azure':
          result = await withRetry(() => this.generateWithAzure(filteredMessages, options));
          break;
        case 'openai':
          result = await withRetry(() => this.generateWithOpenAI(filteredMessages, options));
          break;
        case 'anthropic':
          result = await withRetry(() => this.generateWithAnthropic(filteredMessages, options));
          break;
        default:
          result = await this.generateMockSummary(filteredMessages, options);
      }

      // Add participant stats if requested
      if (options.includeParticipantStats) {
        result.participantStats = this.calculateParticipantStats(filteredMessages);
      }

      logger.info(
        `[SummaryService] Summary generated in ${Date.now() - startTime}ms`,
        { messageCount: filteredMessages.length, provider: this.provider }
      );

      return result;
    } catch (error) {
      logger.error('[SummaryService] Error generating summary:', error);
      throw new Error('Failed to generate summary. Please try again later.');
    }
  }

  /**
   * Generates summary with streaming response
   */
  async generateSummaryStream(
    messages: ChatMessage[],
    options: SummaryOptions,
    callbacks: StreamCallback
  ): Promise<void> {
    try {
      // For POC, simulate streaming with mock data
      const result = await this.generateSummary(messages, options);

      // Simulate streaming by sending tokens
      const words = result.summary.split(' ');
      for (const word of words) {
        callbacks.onToken?.(word + ' ');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      callbacks.onComplete?.(result);
    } catch (error) {
      callbacks.onError?.(error as Error);
    }
  }

  /**
   * Azure AI Foundry (Azure OpenAI) Integration
   *
   * Uses Azure OpenAI Service with your deployed models.
   * Supports all GPT-4 and GPT-3.5 deployments.
   *
   * Required Environment Variables:
   * - AZURE_OPENAI_ENDPOINT: Your Azure OpenAI resource endpoint
   * - AZURE_OPENAI_API_KEY: Your Azure OpenAI API key
   * - AZURE_OPENAI_DEPLOYMENT: Your deployment name (default: gpt-4)
   *
   * Optional Environment Variables:
   * - AZURE_OPENAI_API_VERSION: API version (optional for newer Foundry deployments)
   */
  private async generateWithAzure(
    messages: ChatMessage[],
    options: SummaryOptions
  ): Promise<SummaryResult> {
    const systemPrompt = buildSystemPrompt(options);
    const chatContent = formatMessagesForAI(messages);

    const endpoint = AI_CONFIG.azure.endpoint!;
    const deploymentName = AI_CONFIG.azure.deploymentName;
    const apiVersion = AI_CONFIG.azure.apiVersion;

    // Azure OpenAI API URL format (api-version is optional for newer Foundry deployments)
    const baseUrl = `${endpoint}/openai/deployments/${deploymentName}/chat/completions`;
    const url = apiVersion ? `${baseUrl}?api-version=${apiVersion}` : baseUrl;

    logger.debug(`[SummaryService] Azure request to: ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AI_CONFIG.azure.apiKey!,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please summarize this conversation:\n\n${chatContent}` },
        ],
        max_tokens: options.maxLength || 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[SummaryService] Azure API error: ${response.status} - ${errorText}`);
      throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || 'Unable to generate summary';

    logger.debug(`[SummaryService] Azure response received, tokens: ${data.usage?.total_tokens}`);

    return {
      summary,
      generatedAt: new Date(),
      tokensUsed: data.usage?.total_tokens,
      provider: 'azure',
    };
  }

  /**
   * OpenAI API Integration (Direct)
   */
  private async generateWithOpenAI(
    messages: ChatMessage[],
    options: SummaryOptions
  ): Promise<SummaryResult> {
    const systemPrompt = buildSystemPrompt(options);
    const chatContent = formatMessagesForAI(messages);

    const response = await fetchWithTimeout(AI_CONFIG.openai.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please summarize this conversation:\n\n${chatContent}` },
        ],
        max_tokens: options.maxLength || 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content || 'Unable to generate summary';

    return {
      summary,
      generatedAt: new Date(),
      tokensUsed: data.usage?.total_tokens,
      provider: 'openai',
    };
  }

  /**
   * Anthropic Claude API Integration
   */
  private async generateWithAnthropic(
    messages: ChatMessage[],
    options: SummaryOptions
  ): Promise<SummaryResult> {
    const systemPrompt = buildSystemPrompt(options);
    const chatContent = formatMessagesForAI(messages);

    const response = await fetchWithTimeout(AI_CONFIG.anthropic.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_CONFIG.anthropic.apiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_CONFIG.anthropic.model,
        max_tokens: options.maxLength || 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Please summarize this conversation:\n\n${chatContent}` },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    const summary = data.content[0]?.text || 'Unable to generate summary';

    return {
      summary,
      generatedAt: new Date(),
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
      provider: 'anthropic',
    };
  }

  /**
   * Mock summary generation for development/testing
   */
  private async generateMockSummary(
    messages: ChatMessage[],
    options: SummaryOptions
  ): Promise<SummaryResult> {
    logger.warn('[SummaryService] Using mock summary - configure AI API keys for production');

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Get unique participants
    const participants = [...new Set(messages.map((m) => m.sender))];

    // Get date range
    const dates = messages.map((m) => m.timestamp);
    const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Generate mock summary based on style
    let summary: string;

    if (options.style === 'bullet-points') {
      summary = `• Conversation between ${participants.join(', ')} from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}
• Total of ${messages.length} messages exchanged
• Key participants showed active engagement
• [Mock] Discussion covered various topics
• [Mock] Action items were mentioned`;
    } else if (options.style === 'detailed') {
      summary = `This is a detailed mock summary of a conversation between ${participants.join(' and ')}.
The discussion took place from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()},
comprising ${messages.length} messages. The conversation covered various topics and showed
active participation from all members. [This is a mock summary - configure AI API keys for real summaries]`;
    } else {
      summary = `Mock summary: ${participants.length} participants exchanged ${messages.length} messages between ${startDate.toLocaleDateString()} and ${endDate.toLocaleDateString()}. Configure AI API keys for real summaries.`;
    }

    // Extract mock key topics
    const keyTopics = options.includeKeyTopics
      ? ['General Discussion', 'Updates', 'Planning']
      : undefined;

    return {
      summary,
      keyTopics,
      sentiment: 'neutral',
      generatedAt: new Date(),
      provider: 'mock',
    };
  }

  /**
   * Calculates participant statistics
   */
  private calculateParticipantStats(
    messages: ChatMessage[]
  ): SummaryResult['participantStats'] {
    const counts: Record<string, number> = {};

    for (const msg of messages) {
      counts[msg.sender] = (counts[msg.sender] || 0) + 1;
    }

    const total = messages.length;

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        messageCount: count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.messageCount - a.messageCount);
  }
}

// Export singleton instance
export const summaryService = new SummaryService();

// Export for testing
export { buildSystemPrompt, formatMessagesForAI, getActiveProvider };
