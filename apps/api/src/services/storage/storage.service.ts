/**
 * Storage Service - Multi-Provider File Storage
 *
 * Provides unified file storage interface supporting multiple providers:
 * - Local filesystem storage
 * - AWS S3 storage
 * - Azure Blob Storage
 *
 * Provider Selection Priority:
 * 1. Azure Blob Storage (if AZURE_STORAGE_ACCOUNT_NAME configured)
 * 2. AWS S3 (if AWS_S3_BUCKET configured)
 * 3. Local filesystem (default)
 *
 * Usage:
 * const storage = new StorageService();
 * await storage.uploadFile('exports/chat.json', jsonData);
 * const url = await storage.getFileUrl('exports/chat.json');
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { createHmac } from 'crypto';
import { logger } from '../../utils/logger.js';
import { getStorageProvider, getAzureBlobStorageConfig, type StorageProvider } from '../../config/azure/index.js';

// =============================================================================
// Constants
// =============================================================================

const AZURE_API_VERSION = '2023-11-03';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// Types
// =============================================================================

export interface StorageFile {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  url?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  isPublic?: boolean;
}

export interface StorageServiceConfig {
  provider?: StorageProvider;
  localBasePath?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract HTTP status code from various error formats
 * Supports errors with status, statusCode, or response.status properties
 */
function getHttpStatusFromError(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object') {
    return undefined;
  }

  const err = error as Record<string, unknown>;

  // Direct status property (e.g., from custom errors)
  if (typeof err.status === 'number') {
    return err.status;
  }

  // statusCode property (e.g., from some HTTP libraries)
  if (typeof err.statusCode === 'number') {
    return err.statusCode;
  }

  // Nested response.status (e.g., from axios-like errors)
  if (err.response && typeof err.response === 'object') {
    const response = err.response as Record<string, unknown>;
    if (typeof response.status === 'number') {
      return response.status;
    }
  }

  return undefined;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
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
 * Retry helper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelayMs: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx) except rate limiting (429)
      const status = getHttpStatusFromError(error);
      if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        logger.warn(`[StorageService] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// Storage Service
// =============================================================================

export class StorageService {
  private provider: StorageProvider;
  private localBasePath: string;

  constructor(config: StorageServiceConfig = {}) {
    this.provider = config.provider || getStorageProvider();
    this.localBasePath = config.localBasePath || process.env.UPLOAD_DIR || './uploads';

    logger.info(`[StorageService] Using provider: ${this.provider}`);
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    key: string,
    data: Buffer | string,
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    switch (this.provider) {
      case 'azure-blob':
        return this.uploadToAzure(key, data, options);
      case 'aws-s3':
        return this.uploadToS3(key, data, options);
      default:
        return this.uploadToLocal(key, data, options);
    }
  }

  /**
   * Download a file from storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    switch (this.provider) {
      case 'azure-blob':
        return this.downloadFromAzure(key);
      case 'aws-s3':
        return this.downloadFromS3(key);
      default:
        return this.downloadFromLocal(key);
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(key: string): Promise<void> {
    switch (this.provider) {
      case 'azure-blob':
        return this.deleteFromAzure(key);
      case 'aws-s3':
        return this.deleteFromS3(key);
      default:
        return this.deleteFromLocal(key);
    }
  }

  /**
   * Get a signed URL for file access
   */
  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    switch (this.provider) {
      case 'azure-blob':
        return this.getAzureUrl(key, expiresIn);
      case 'aws-s3':
        return this.getS3Url(key, expiresIn);
      default:
        return this.getLocalUrl(key);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    switch (this.provider) {
      case 'azure-blob':
        return this.existsInAzure(key);
      case 'aws-s3':
        return this.existsInS3(key);
      default:
        return this.existsInLocal(key);
    }
  }

  /**
   * List files in a directory/prefix
   */
  async listFiles(prefix: string): Promise<StorageFile[]> {
    switch (this.provider) {
      case 'azure-blob':
        return this.listInAzure(prefix);
      case 'aws-s3':
        return this.listInS3(prefix);
      default:
        return this.listInLocal(prefix);
    }
  }

  // ===========================================================================
  // Local Storage Implementation
  // ===========================================================================

  private async uploadToLocal(key: string, data: Buffer | string, options: UploadOptions): Promise<StorageFile> {
    const filePath = join(this.localBasePath, key);
    const dirPath = dirname(filePath);

    await fs.mkdir(dirPath, { recursive: true });

    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    await fs.writeFile(filePath, buffer);

    const stats = await fs.stat(filePath);

    return {
      key,
      size: stats.size,
      contentType: options.contentType || 'application/octet-stream',
      lastModified: stats.mtime,
      url: this.getLocalUrl(key),
    };
  }

  private async downloadFromLocal(key: string): Promise<Buffer> {
    const filePath = join(this.localBasePath, key);
    return fs.readFile(filePath);
  }

  private async deleteFromLocal(key: string): Promise<void> {
    const filePath = join(this.localBasePath, key);
    await fs.unlink(filePath);
  }

  private getLocalUrl(key: string): string {
    return `/uploads/${key}`;
  }

  private async existsInLocal(key: string): Promise<boolean> {
    try {
      const filePath = join(this.localBasePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async listInLocal(prefix: string): Promise<StorageFile[]> {
    const dirPath = join(this.localBasePath, prefix);
    const files: StorageFile[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = join(dirPath, entry.name);
          const stats = await fs.stat(filePath);
          files.push({
            key: join(prefix, entry.name),
            size: stats.size,
            contentType: 'application/octet-stream',
            lastModified: stats.mtime,
          });
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return files;
  }

  // ===========================================================================
  // Azure Blob Storage Implementation
  // ===========================================================================

  private async uploadToAzure(key: string, data: Buffer | string, options: UploadOptions): Promise<StorageFile> {
    const config = getAzureBlobStorageConfig();
    if (!config) throw new Error('Azure Blob Storage not configured');

    const buffer = typeof data === 'string' ? Buffer.from(data) : data;

    // Build Azure Blob Storage URL
    const url = this.buildAzureBlobUrl(config.accountName, config.containerName, key);

    const headers: Record<string, string> = {
      'Content-Type': options.contentType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
      'x-ms-blob-type': 'BlockBlob',
      'x-ms-version': '2023-11-03',
      'x-ms-date': new Date().toUTCString(),
    };

    // Add SAS token or account key authentication
    let authUrl = url;
    if (config.sasToken) {
      authUrl = `${url}?${config.sasToken}`;
    } else if (config.accountKey) {
      // For production, use Azure SDK or proper HMAC signing
      // This is a simplified version for POC
      headers['Authorization'] = this.createAzureAuthHeader(
        'PUT',
        config.accountName,
        config.containerName,
        key,
        config.accountKey,
        headers
      );
    }

    const response = await withRetry(async () => {
      const res = await fetchWithTimeout(authUrl, {
        method: 'PUT',
        headers,
        body: buffer,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Azure Blob upload failed: ${res.status} - ${errorText}`);
      }

      return res;
    });

    logger.info(`[StorageService] Uploaded to Azure: ${key}`);

    return {
      key,
      size: buffer.length,
      contentType: options.contentType || 'application/octet-stream',
      lastModified: new Date(),
      url: this.getAzureUrl(key, 3600),
    };
  }

  private async downloadFromAzure(key: string): Promise<Buffer> {
    const config = getAzureBlobStorageConfig();
    if (!config) throw new Error('Azure Blob Storage not configured');

    let url = this.buildAzureBlobUrl(config.accountName, config.containerName, key);

    if (config.sasToken) {
      url = `${url}?${config.sasToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'x-ms-version': '2023-11-03',
      },
    });

    if (!response.ok) {
      throw new Error(`Azure Blob download failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async deleteFromAzure(key: string): Promise<void> {
    const config = getAzureBlobStorageConfig();
    if (!config) throw new Error('Azure Blob Storage not configured');

    let url = this.buildAzureBlobUrl(config.accountName, config.containerName, key);

    if (config.sasToken) {
      url = `${url}?${config.sasToken}`;
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-ms-version': '2023-11-03',
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Azure Blob delete failed: ${response.status}`);
    }
  }

  private getAzureUrl(key: string, expiresIn: number): string {
    const config = getAzureBlobStorageConfig();
    if (!config) return '';

    let url = this.buildAzureBlobUrl(config.accountName, config.containerName, key);

    if (config.sasToken) {
      url = `${url}?${config.sasToken}`;
    }

    return url;
  }

  private async existsInAzure(key: string): Promise<boolean> {
    const config = getAzureBlobStorageConfig();
    if (!config) return false;

    let url = this.buildAzureBlobUrl(config.accountName, config.containerName, key);

    if (config.sasToken) {
      url = `${url}?${config.sasToken}`;
    }

    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'x-ms-version': '2023-11-03',
      },
    });

    return response.ok;
  }

  private async listInAzure(prefix: string): Promise<StorageFile[]> {
    const config = getAzureBlobStorageConfig();
    if (!config) return [];

    const baseUrl = `https://${config.accountName}.blob.core.windows.net/${config.containerName}`;
    let url = `${baseUrl}?restype=container&comp=list&prefix=${encodeURIComponent(prefix)}`;

    if (config.sasToken) {
      url = `${url}&${config.sasToken}`;
    }

    const response = await fetch(url, {
      headers: {
        'x-ms-version': '2023-11-03',
      },
    });

    if (!response.ok) {
      throw new Error(`Azure Blob list failed: ${response.status}`);
    }

    const text = await response.text();
    return this.parseAzureBlobListXml(text);
  }

  /**
   * Safely parse Azure Blob Storage list XML response
   * Uses a simple state-machine parser instead of regex for security and reliability
   */
  private parseAzureBlobListXml(xml: string): StorageFile[] {
    const files: StorageFile[] = [];

    // Simple iterative parser - safer than regex for XML
    let pos = 0;

    while (pos < xml.length) {
      // Find next <Blob> tag
      const blobStart = xml.indexOf('<Blob>', pos);
      if (blobStart === -1) break;

      const blobEnd = xml.indexOf('</Blob>', blobStart);
      if (blobEnd === -1) break;

      const blobContent = xml.slice(blobStart, blobEnd);

      // Extract Name
      const name = this.extractXmlElement(blobContent, 'Name');
      if (!name) {
        pos = blobEnd + 7;
        continue;
      }

      // Extract Content-Length
      const contentLength = this.extractXmlElement(blobContent, 'Content-Length');
      const size = contentLength ? parseInt(contentLength, 10) : 0;

      // Extract Last-Modified
      const lastModified = this.extractXmlElement(blobContent, 'Last-Modified');

      // Extract Content-Type if available
      const contentType = this.extractXmlElement(blobContent, 'Content-Type') || 'application/octet-stream';

      files.push({
        key: this.decodeXmlEntities(name),
        size: isNaN(size) ? 0 : size,
        contentType,
        lastModified: lastModified ? new Date(lastModified) : new Date(),
      });

      pos = blobEnd + 7;
    }

    return files;
  }

  /**
   * Extract text content from an XML element
   */
  private extractXmlElement(xml: string, tagName: string): string | null {
    const openTag = `<${tagName}>`;
    const closeTag = `</${tagName}>`;

    const startIdx = xml.indexOf(openTag);
    if (startIdx === -1) return null;

    const contentStart = startIdx + openTag.length;
    const endIdx = xml.indexOf(closeTag, contentStart);
    if (endIdx === -1) return null;

    return xml.slice(contentStart, endIdx);
  }

  /**
   * Decode common XML entities
   */
  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  private buildAzureBlobUrl(accountName: string, containerName: string, blobName: string): string {
    return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`;
  }

  /**
   * Create Azure SharedKey authentication header using HMAC-SHA256
   *
   * @see https://docs.microsoft.com/rest/api/storageservices/authorize-with-shared-key
   */
  private createAzureAuthHeader(
    method: string,
    accountName: string,
    containerName: string,
    blobName: string,
    accountKey: string,
    headers: Record<string, string>
  ): string {
    // Build canonicalized headers (x-ms-* headers, sorted alphabetically)
    const canonicalizedHeaders = Object.keys(headers)
      .filter(key => key.toLowerCase().startsWith('x-ms-'))
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');

    // Build canonicalized resource
    const canonicalizedResource = `/${accountName}/${containerName}/${blobName}`;

    // Build string to sign (Blob service format)
    // https://docs.microsoft.com/rest/api/storageservices/authorize-with-shared-key#blob-queue-and-file-services-shared-key-lite-and-table-service-shared-key-lite-authorization
    const contentLength = headers['Content-Length'] || '';
    const contentType = headers['Content-Type'] || '';

    const stringToSign = [
      method,                              // HTTP Verb
      '',                                  // Content-Encoding
      '',                                  // Content-Language
      contentLength,                       // Content-Length
      '',                                  // Content-MD5
      contentType,                         // Content-Type
      '',                                  // Date (empty when x-ms-date is used)
      '',                                  // If-Modified-Since
      '',                                  // If-Match
      '',                                  // If-None-Match
      '',                                  // If-Unmodified-Since
      '',                                  // Range
      canonicalizedHeaders,                // Canonicalized headers
      canonicalizedResource,               // Canonicalized resource
    ].join('\n');

    // Create HMAC-SHA256 signature
    const { createHmac } = require('crypto');
    const decodedKey = Buffer.from(accountKey, 'base64');
    const signature = createHmac('sha256', decodedKey)
      .update(stringToSign, 'utf8')
      .digest('base64');

    return `SharedKey ${accountName}:${signature}`;
  }

  // ===========================================================================
  // AWS S3 Implementation
  // ===========================================================================
  // NOTE: AWS S3 requires @aws-sdk/client-s3 package. Install it if you need S3 support.
  // npm install @aws-sdk/client-s3

  private assertS3NotImplemented(): never {
    const message =
      '[StorageService] AWS S3 is configured but not implemented. ' +
      'Either install @aws-sdk/client-s3 and implement S3 methods, ' +
      'or switch to Azure Blob Storage or local filesystem. ' +
      'Set STORAGE_PROVIDER=local to use local storage instead.';
    logger.error(message);
    throw new Error(message);
  }

  private async uploadToS3(key: string, data: Buffer | string, options: UploadOptions): Promise<StorageFile> {
    this.assertS3NotImplemented();
  }

  private async downloadFromS3(key: string): Promise<Buffer> {
    this.assertS3NotImplemented();
  }

  private async deleteFromS3(key: string): Promise<void> {
    this.assertS3NotImplemented();
  }

  private getS3Url(key: string, expiresIn: number): string {
    this.assertS3NotImplemented();
  }

  private async existsInS3(key: string): Promise<boolean> {
    this.assertS3NotImplemented();
  }

  private async listInS3(prefix: string): Promise<StorageFile[]> {
    this.assertS3NotImplemented();
  }
}

// Export singleton instance
export const storageService = new StorageService();
