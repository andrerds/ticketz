# Design Document: S3-Compatible Media Storage System

## Overview

This design document outlines the technical architecture for implementing a flexible media storage system that supports both local filesystem and S3-compatible cloud storage. The solution follows Domain-Driven Design (DDD) principles and Clean Architecture patterns, ensuring separation of concerns, testability, and maintainability.

The system will enable multi-tenant companies to independently configure their storage backend while maintaining backward compatibility with existing local media files. The design prioritizes zero-downtime migration, security of credentials, and optional image optimization to reduce costs.

### Key Design Goals

1. **Abstraction**: Single storage interface regardless of backend (Local or S3)
2. **Backward Compatibility**: Existing local files continue to work after S3 enablement
3. **Security**: Encrypted credential storage with masked API responses
4. **Performance**: Caching, streaming, and controlled image optimization
5. **Multi-tenancy**: Per-company storage configuration with proper isolation
6. **Testability**: Dependency injection and mock support for testing

## Architecture

### Layered Architecture (DDD)

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  - SettingController (storage config endpoints)              │
│  - MediaController (GET /public/*)                           │
│  - Frontend Settings UI                                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  - SaveMediaService (orchestrates storage operations)        │
│  - GetStorageConfigService (retrieves company config)        │
│  - ValidateS3ConfigService (validates credentials)           │
│  - MigrateMediaService (migrates local → S3)                 │
│  - OptimizeImageService (image processing)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│  - StorageDriver (interface)                                 │
│  - StorageConfig (value object)                              │
│  - MediaFile (entity)                                        │
│  - EncryptionService (domain service)                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  - LocalStorageDriver (implements StorageDriver)             │
│  - S3StorageDriver (implements StorageDriver)                │
│  - StorageDriverFactory (creates drivers)                    │
│  - CredentialEncryption (AES-256-GCM)                        │
│  - Setting (database model)                                  │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Upload → saveMediaToFile() → GetStorageConfig(companyId)
                                          ↓
                                   StorageDriverFactory
                                          ↓
                              ┌───────────┴───────────┐
                              ↓                       ↓
                      LocalStorageDriver      S3StorageDriver
                              ↓                       ↓
                         Filesystem              AWS S3 SDK
```

```
User Download → GET /public/* → Check Local Filesystem
                                        ↓
                                   File exists?
                                   ↙         ↘
                                 Yes          No
                                  ↓            ↓
                            Stream File    GetStorageConfig
                                                ↓
                                         S3StorageDriver
                                                ↓
                                          Stream from S3
```

## Components and Interfaces

### 1. Storage Driver Interface (Domain Layer)

```typescript
// backend/src/domain/storage/IStorageDriver.ts
export interface IStorageDriver {
  /**
   * Write a file to storage
   * @param key - The storage key/path
   * @param data - File contents as Buffer or Stream
   * @param mimetype - MIME type of the file
   * @returns Promise<void>
   */
  write(key: string, data: Buffer | NodeJS.ReadableStream, mimetype: string): Promise<void>;

  /**
   * Read a file from storage
   * @param key - The storage key/path
   * @returns Promise<NodeJS.ReadableStream> - Stream of file contents
   */
  read(key: string): Promise<NodeJS.ReadableStream>;

  /**
   * Check if a file exists
   * @param key - The storage key/path
   * @returns Promise<boolean>
   */
  exists(key: string): Promise<boolean>;

  /**
   * Delete a file from storage
   * @param key - The storage key/path
   * @returns Promise<void>
   */
  delete(key: string): Promise<void>;

  /**
   * Get a signed URL for direct access (S3 only)
   * @param key - The storage key/path
   * @param expiresIn - Expiration time in seconds
   * @returns Promise<string | null>
   */
  getSignedUrl(key: string, expiresIn: number): Promise<string | null>;
}
```

### 2. Storage Configuration (Domain Value Object)

```typescript
// backend/src/domain/storage/StorageConfig.ts
export type StorageDriver = 'local' | 's3';

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string; // Encrypted in database
  forcePathStyle: boolean;
  prefix?: string;
}

export interface ImageOptimizationConfig {
  enabled: boolean;
  maxWidth: number;
  quality: number;
  maxBytes: number;
}

export class StorageConfig {
  constructor(
    public readonly companyId: number,
    public readonly driver: StorageDriver,
    public readonly s3Config?: S3Config,
    public readonly imageOptimization?: ImageOptimizationConfig
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.driver === 's3' && !this.s3Config) {
      throw new Error('S3 configuration required when driver is s3');
    }
    
    if (this.s3Config) {
      const required = ['endpoint', 'region', 'bucket', 'accessKeyId', 'secretAccessKey'];
      for (const field of required) {
        if (!this.s3Config[field]) {
          throw new Error(`S3 configuration missing required field: ${field}`);
        }
      }
    }
  }

  public maskSecrets(): StorageConfig {
    if (!this.s3Config) return this;
    
    return new StorageConfig(
      this.companyId,
      this.driver,
      {
        ...this.s3Config,
        secretAccessKey: '*****'
      },
      this.imageOptimization
    );
  }
}
```

### 3. Local Storage Driver (Infrastructure)

```typescript
// backend/src/infrastructure/storage/LocalStorageDriver.ts
import { IStorageDriver } from '../../domain/storage/IStorageDriver';
import { FileStorage } from '@flystorage/file-storage';
import { LocalStorageAdapter } from '@flystorage/local-fs';
import { getPublicPath } from '../../helpers/GetPublicPath';
import fs from 'fs';
import path from 'path';

export class LocalStorageDriver implements IStorageDriver {
  private storage: FileStorage;

  constructor() {
    this.storage = new FileStorage(new LocalStorageAdapter(getPublicPath()));
  }

  async write(key: string, data: Buffer | NodeJS.ReadableStream, mimetype: string): Promise<void> {
    await this.storage.write(key, data);
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    const fullPath = path.join(getPublicPath(), key);
    return fs.createReadStream(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(getPublicPath(), key);
    return fs.promises.access(fullPath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(getPublicPath(), key);
    await fs.promises.unlink(fullPath);
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string | null> {
    // Local storage doesn't support signed URLs
    return null;
  }
}
```

### 4. S3 Storage Driver (Infrastructure)

```typescript
// backend/src/infrastructure/storage/S3StorageDriver.ts
import { IStorageDriver } from '../../domain/storage/IStorageDriver';
import { S3Config } from '../../domain/storage/StorageConfig';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export class S3StorageDriver implements IStorageDriver {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      forcePathStyle: config.forcePathStyle
    });
    this.bucket = config.bucket;
    this.prefix = config.prefix || '';
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async write(key: string, data: Buffer | NodeJS.ReadableStream, mimetype: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    const body = Buffer.isBuffer(data) ? data : await this.streamToBuffer(data);
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: body,
      ContentType: mimetype
    });

    await this.client.send(command);
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });

    const response = await this.client.send(command);
    return response.Body as Readable;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });
    await this.client.send(command);
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });
    return await getSignedUrl(this.client, command, { expiresIn });
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
```

### 5. Storage Driver Factory (Infrastructure)

```typescript
// backend/src/infrastructure/storage/StorageDriverFactory.ts
import { IStorageDriver } from '../../domain/storage/IStorageDriver';
import { StorageConfig } from '../../domain/storage/StorageConfig';
import { LocalStorageDriver } from './LocalStorageDriver';
import { S3StorageDriver } from './S3StorageDriver';
import { SimpleObjectCache } from '../../helpers/simpleObjectCache';
import { logger } from '../../utils/logger';

export class StorageDriverFactory {
  private static driverCache = new SimpleObjectCache<IStorageDriver>(1000 * 60 * 5, logger);

  static async createDriver(config: StorageConfig): Promise<IStorageDriver> {
    const cacheKey = `storage-driver-${config.companyId}`;
    
    const cached = this.driverCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let driver: IStorageDriver;

    if (config.driver === 's3') {
      driver = new S3StorageDriver(config.s3Config!);
    } else {
      driver = new LocalStorageDriver();
    }

    this.driverCache.set(cacheKey, driver);
    return driver;
  }

  static clearCache(companyId: number): void {
    const cacheKey = `storage-driver-${companyId}`;
    this.driverCache.delete(cacheKey);
  }
}
```

### 6. Credential Encryption Service (Domain Service)

```typescript
// backend/src/domain/storage/EncryptionService.ts
import crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly AUTH_TAG_LENGTH = 16;

  static encrypt(text: string, masterKey: string): string {
    if (!masterKey || masterKey.length !== 64) {
      throw new Error('Master key must be 64 hex characters (32 bytes)');
    }

    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = Buffer.from(masterKey, 'hex');
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  static decrypt(encryptedText: string, masterKey: string): string {
    if (!masterKey || masterKey.length !== 64) {
      throw new Error('Master key must be 64 hex characters (32 bytes)');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(masterKey, 'hex');

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 7. Media Management Service (Application Layer)

```typescript
// backend/src/services/MediaServices/ListMediaFilesService.ts
import Message from '../../models/Message';
import { Op } from 'sequelize';

export interface MediaFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  fileType: string;
  storageLocation: 'local' | 's3';
  messageId: string;
  mediaUrl: string;
  isDeleted: boolean;
  canDelete: boolean;
}

export interface MediaFilters {
  startDate?: Date;
  endDate?: Date;
  fileType?: string;
  storageLocation?: 'local' | 's3';
}

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  byLocation: Record<string, { count: number; size: number }>;
}

export async function listMediaFiles(
  companyId: number,
  filters?: MediaFilters
): Promise<MediaFileInfo[]> {
  const whereClause: any = {
    companyId,
    mediaUrl: { [Op.ne]: null }
  };

  if (filters?.startDate || filters?.endDate) {
    whereClause.createdAt = {};
    if (filters.startDate) {
      whereClause.createdAt[Op.gte] = filters.startDate;
    }
    if (filters.endDate) {
      whereClause.createdAt[Op.lte] = filters.endDate;
    }
  }

  if (filters?.fileType) {
    whereClause.mediaType = filters.fileType;
  }

  const messages = await Message.findAll({
    where: whereClause,
    order: [['createdAt', 'DESC']]
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return messages.map(msg => {
    const mediaUrl = msg.getDataValue('mediaUrl');
    const isAbsoluteUrl = mediaUrl?.match(/^https?:\/\//);
    const storageLocation = isAbsoluteUrl ? 's3' : 'local';
    
    // Filter by storage location if specified
    if (filters?.storageLocation && storageLocation !== filters.storageLocation) {
      return null;
    }

    return {
      id: msg.id,
      fileName: extractFileName(mediaUrl),
      fileSize: 0, // Will be populated by checking actual file
      uploadDate: msg.createdAt,
      fileType: msg.mediaType,
      storageLocation,
      messageId: msg.id,
      mediaUrl,
      isDeleted: msg.isDeleted,
      canDelete: msg.createdAt < thirtyDaysAgo
    };
  }).filter(Boolean);
}

export async function getMediaStats(companyId: number): Promise<MediaStats> {
  const messages = await Message.findAll({
    where: {
      companyId,
      mediaUrl: { [Op.ne]: null }
    },
    attributes: ['mediaType', 'mediaUrl']
  });

  const stats: MediaStats = {
    totalFiles: messages.length,
    totalSize: 0,
    byType: {},
    byLocation: { local: { count: 0, size: 0 }, s3: { count: 0, size: 0 } }
  };

  for (const msg of messages) {
    const mediaUrl = msg.getDataValue('mediaUrl');
    const isAbsoluteUrl = mediaUrl?.match(/^https?:\/\//);
    const location = isAbsoluteUrl ? 's3' : 'local';
    const type = msg.mediaType || 'unknown';

    // Initialize type stats if needed
    if (!stats.byType[type]) {
      stats.byType[type] = { count: 0, size: 0 };
    }

    stats.byType[type].count++;
    stats.byLocation[location].count++;

    // TODO: Get actual file size from storage
  }

  return stats;
}

function extractFileName(mediaUrl: string): string {
  if (!mediaUrl) return 'unknown';
  const parts = mediaUrl.split('/');
  return parts[parts.length - 1];
}
```

```typescript
// backend/src/services/MediaServices/DeleteMediaFileService.ts
import Message from '../../models/Message';
import { StorageDriverFactory } from '../../infrastructure/storage/StorageDriverFactory';
import { GetStorageConfigService } from './GetStorageConfigService';
import { logger } from '../../utils/logger';
import AppError from '../../errors/AppError';

export interface DeleteMediaRequest {
  messageId: string;
  companyId: number;
  userId: number;
}

export interface DeleteMediaResult {
  success: boolean;
  messageId: string;
  error?: string;
}

export async function deleteMediaFile(
  request: DeleteMediaRequest
): Promise<DeleteMediaResult> {
  try {
    const message = await Message.findOne({
      where: {
        id: request.messageId,
        companyId: request.companyId
      }
    });

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check if file is older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (message.createdAt >= thirtyDaysAgo) {
      throw new AppError('Cannot delete media files newer than 30 days', 403);
    }

    const mediaUrl = message.getDataValue('mediaUrl');
    if (!mediaUrl) {
      throw new AppError('Message has no media', 400);
    }

    // Get storage configuration and driver
    const config = await GetStorageConfigService(request.companyId);
    const driver = await StorageDriverFactory.createDriver(config);

    // Extract media key from URL
    const mediaKey = mediaUrl.replace(/^https?:\/\/[^\/]+\/public\//, '');

    // Delete from storage
    try {
      await driver.delete(mediaKey);
    } catch (error) {
      logger.warn({ error, mediaKey }, 'Failed to delete media file from storage');
      // Continue even if storage deletion fails
    }

    // Mark message as deleted
    await message.update({
      isDeleted: true,
      mediaUrl: `deleted:${mediaUrl}` // Preserve original URL for audit
    });

    // Log the deletion for audit
    logger.info({
      messageId: request.messageId,
      userId: request.userId,
      companyId: request.companyId,
      mediaUrl
    }, 'Media file manually deleted');

    return {
      success: true,
      messageId: request.messageId
    };
  } catch (error) {
    logger.error({ error, request }, 'Error deleting media file');
    return {
      success: false,
      messageId: request.messageId,
      error: error.message
    };
  }
}

export async function bulkDeleteMediaFiles(
  requests: DeleteMediaRequest[]
): Promise<DeleteMediaResult[]> {
  const results: DeleteMediaResult[] = [];

  for (const request of requests) {
    const result = await deleteMediaFile(request);
    results.push(result);
  }

  return results;
}
```

## Data Models

### Storage Settings Schema

The storage configuration will be stored in the existing `Settings` table with the following keys:

```typescript
// Storage driver selection
storageDriver: "local" | "s3"  // Default: "local"

// S3 configuration (JSON string)
storageS3Config: {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;  // Encrypted with AES-256-GCM
  forcePathStyle: boolean;
  prefix?: string;
}

// Image optimization configuration (JSON string)
storageImageOptimization: {
  enabled: boolean;
  maxWidth: number;        // Default: 1920
  quality: number;         // Default: 80 (0-100)
  maxBytes: number;        // Default: 1048576 (1MB)
}
```

### Environment Variables

```bash
# Master key for encrypting storage credentials (32 bytes = 64 hex chars)
STORAGE_CREDENTIALS_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Backend URL for constructing media URLs
BACKEND_URL=http://localhost:8080
```

### Message Model (No Changes Required)

The existing `Message` model already supports the required functionality:
- Stores `mediaUrl` and `thumbnailUrl` as relative paths
- Getter methods construct full URLs with `BACKEND_URL/public/` prefix
- Supports absolute URLs (starting with `http://` or `https://`)
- `isDeleted` flag to mark deleted media

### Media Management API Endpoints

```typescript
// GET /api/media - List media files with filters
// Query params: startDate, endDate, fileType, storageLocation
// Response: MediaFileInfo[]

// GET /api/media/stats - Get storage statistics
// Response: MediaStats

// DELETE /api/media/:messageId - Delete single media file
// Response: DeleteMediaResult

// POST /api/media/bulk-delete - Delete multiple media files
// Body: { messageIds: string[] }
// Response: DeleteMediaResult[]
```

### Frontend Components

```typescript
// MediaManagement Page Structure
- MediaManagementPage
  - MediaFilters (date range, type, location)
  - MediaStats (total usage, breakdown)
  - MediaFileList
    - MediaFileCard (with delete button if > 30 days)
    - BulkActions (select all, delete selected)
  - DeleteConfirmationDialog
  - MediaPlaceholder (for deleted media in messages)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Default storage driver

*For any* newly created company, the storage driver should default to "local"
**Validates: Requirements 1.1**

### Property 2: S3 credential validation

*For any* S3 configuration, when saved, the system should validate credentials by testing connectivity before persisting
**Validates: Requirements 1.2, 6.3**

### Property 3: Credential encryption

*For any* S3 configuration with secretAccessKey, when saved, the stored value should be encrypted and different from the plaintext input
**Validates: Requirements 1.3, 6.1**

### Property 4: Secret masking in API responses

*For any* storage configuration retrieval via API, the secretAccessKey field should never contain the actual secret value
**Validates: Requirements 1.4, 6.2**

### Property 5: S3 configuration persistence

*For any* valid S3 configuration, when saved, all required fields (endpoint, region, bucket, accessKeyId, forcePathStyle, prefix) should be retrievable
**Validates: Requirements 1.5**

### Property 6: Storage driver selection

*For any* media file save operation, the storage driver used should match the company's configured driver
**Validates: Requirements 2.1**

### Property 7: Media key format consistency

*For any* media file, the key format should be identical regardless of whether it's stored locally or in S3
**Validates: Requirements 2.2**

### Property 8: Storage operation error handling

*For any* storage operation failure, the system should throw an error with a clear message indicating the failure reason
**Validates: Requirements 2.3**

### Property 9: Configuration caching

*For any* company, when storage configuration is retrieved multiple times within the cache TTL, the database should only be queried once
**Validates: Requirements 2.4**

### Property 10: Media URL format

*For any* message with media, the mediaUrl should be in the format `BACKEND_URL/public/<key>` when not an absolute URL
**Validates: Requirements 3.1**

### Property 11: Local filesystem priority

*For any* media file request, the system should check local filesystem before attempting S3 retrieval
**Validates: Requirements 3.2**

### Property 12: S3 fallback retrieval

*For any* media file that doesn't exist locally, if S3 is configured, the system should attempt to retrieve it from S3
**Validates: Requirements 3.3**

### Property 13: Content-Type headers

*For any* file streamed from S3, the response should include the appropriate Content-Type header based on the file's mimetype
**Validates: Requirements 3.4**

### Property 14: Backward compatibility

*For any* existing local media file, after enabling S3 storage, the file should remain accessible through the same URL
**Validates: Requirements 4.1**

### Property 15: New media storage location

*For any* new media upload, the file should be stored in the currently configured storage driver
**Validates: Requirements 4.2**

### Property 16: Local precedence in hybrid mode

*For any* media file that exists in both local and S3 storage, the system should serve the local version
**Validates: Requirements 4.3**

### Property 17: Migration key preservation

*For any* media file migrated from local to S3, the media key should remain unchanged
**Validates: Requirements 4.5, 9.2**

### Property 18: Image-only optimization

*For any* file upload, when image optimization is enabled, only files with image/* mimetype should be processed
**Validates: Requirements 5.1**

### Property 19: Size-based optimization

*For any* image file, optimization should only occur when the file size exceeds the configured threshold
**Validates: Requirements 5.2**

### Property 20: Optimization failure recovery

*For any* image where optimization fails, the original file should be saved successfully
**Validates: Requirements 5.4**

### Property 21: Audit logging

*For any* access to storage credentials, an audit log entry should be created
**Validates: Requirements 6.5**

### Property 22: Upload failure prevents message creation

*For any* media upload failure, the associated message should not be created in the database
**Validates: Requirements 7.5**

### Property 23: Required field validation

*For any* S3 configuration save attempt, if required fields are missing, the system should reject the configuration with a validation error
**Validates: Requirements 8.3**

### Property 24: Migration completeness

*For any* company migration, all local media files for that company should be enumerated and processed
**Validates: Requirements 9.1**

### Property 25: Migration optional cleanup

*For any* successful file migration, when delete option is enabled, the local file should be removed
**Validates: Requirements 9.3**

### Property 26: Migration error resilience

*For any* migration with partial failures, the process should continue processing remaining files and log failures
**Validates: Requirements 9.4**

### Property 27: Dry-run validation

*For any* storage configuration validation in dry-run mode, no data should be persisted to the database
**Validates: Requirements 10.3**

### Property 28: Media grouping by date and type

*For any* company's media files, when retrieved for management, files should be correctly grouped by date and file type
**Validates: Requirements 11.1**

### Property 29: Media information completeness

*For any* media file in the management view, the response should include file name, size, upload date, message reference, and storage location
**Validates: Requirements 11.2**

### Property 30: Age-based deletion permission

*For any* media file older than 30 days, the system should allow deletion
**Validates: Requirements 11.3**

### Property 31: Recent file protection

*For any* media file newer than 30 days, the system should prevent deletion
**Validates: Requirements 11.4**

### Property 32: Deleted media marking

*For any* media file deletion, the associated message's mediaUrl should be marked as deleted
**Validates: Requirements 11.5**

### Property 33: Deleted media placeholder

*For any* message with deleted media, the UI should display a placeholder indicating manual removal
**Validates: Requirements 11.6**

### Property 34: Media filtering

*For any* media file query with filters (date range, file type, storage location), only files matching all filter criteria should be returned
**Validates: Requirements 11.7**

### Property 35: Bulk deletion processing

*For any* bulk deletion request, all specified files should be processed
**Validates: Requirements 11.8**

### Property 36: Deletion error resilience

*For any* bulk deletion with partial failures, the system should continue processing remaining files and log failures
**Validates: Requirements 11.9**

### Property 37: Storage usage statistics

*For any* company, the storage usage statistics should accurately reflect total size and breakdown by file type
**Validates: Requirements 11.10**

## Error Handling

### Error Types and Messages

```typescript
// backend/src/errors/StorageErrors.ts
export class StorageError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class S3AuthenticationError extends StorageError {
  constructor() {
    super('S3 authentication failed. Please verify your accessKeyId and secretAccessKey.', 'ERR_S3_AUTH_FAILED');
  }
}

export class S3BucketNotFoundError extends StorageError {
  constructor(bucket: string) {
    super(`S3 bucket '${bucket}' not found. Please verify the bucket exists and you have access.`, 'ERR_S3_BUCKET_NOT_FOUND');
  }
}

export class S3NetworkError extends StorageError {
  constructor() {
    super('Network connectivity to S3 failed. Please check your connection and try again.', 'ERR_S3_NETWORK_FAILED');
  }
}

export class DiskSpaceError extends StorageError {
  constructor() {
    super('Insufficient disk space available for media storage.', 'ERR_DISK_SPACE_EXHAUSTED');
  }
}

export class EncryptionKeyMissingError extends StorageError {
  constructor() {
    super('STORAGE_CREDENTIALS_KEY environment variable is required for encrypting S3 credentials.', 'ERR_ENCRYPTION_KEY_MISSING');
  }
}

export class MediaUploadError extends StorageError {
  constructor(originalError: Error) {
    super(`Media upload failed: ${originalError.message}`, 'ERR_MEDIA_UPLOAD_FAILED');
  }
}
```

### Error Handling Strategy

1. **Fail Fast**: Validate configuration before persisting
2. **Clear Messages**: Provide actionable error messages
3. **Logging**: Log all errors with context for debugging
4. **Transactional**: Prevent message creation if media upload fails
5. **Retry Logic**: Implement exponential backoff for transient S3 errors

## Testing Strategy

### Unit Testing

Unit tests will verify specific components in isolation:

1. **EncryptionService**: Test encryption/decryption round-trip
2. **StorageConfig**: Test validation logic for required fields
3. **StorageDriverFactory**: Test driver creation based on configuration
4. **LocalStorageDriver**: Test file operations with mock filesystem
5. **S3StorageDriver**: Test S3 operations with mocked AWS SDK
6. **Image Optimization**: Test resize and compression logic

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** library:

1. **Property 1-27**: Each correctness property will be implemented as a property-based test
2. **Test Configuration**: Minimum 100 iterations per property test
3. **Generators**: Custom generators for:
   - Random company IDs
   - Random storage configurations
   - Random media files with various mimetypes
   - Random file sizes and dimensions
4. **Tagging**: Each test tagged with `Feature: s3-media-storage, Property N: <description>`

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Hybrid Mode**: Upload to S3, verify fallback to local for old files
2. **Migration**: Migrate files from local to S3, verify accessibility
3. **API Endpoints**: Test GET /public/* with various storage configurations
4. **Settings Management**: Test storage configuration CRUD operations

### Test Dependencies

```json
{
  "devDependencies": {
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/s3-request-presigner": "^3.x",
    "fast-check": "^3.x",
    "mock-fs": "^5.x"
  }
}
```

## Performance Considerations

### Caching Strategy

1. **Storage Configuration**: Cache for 5 minutes per company
2. **Storage Drivers**: Cache driver instances to avoid recreation
3. **Cache Invalidation**: Clear cache when configuration is updated

### Image Optimization

1. **Concurrency Limit**: Maximum 2 concurrent optimizations using `async-mutex`
2. **Size Threshold**: Only optimize images > 1MB by default
3. **Async Processing**: Consider Bull queue for background optimization (Phase 4)

### Streaming

1. **Direct Streaming**: Stream files from S3 to client without buffering
2. **Chunk Size**: Use appropriate chunk sizes for memory efficiency
3. **Backpressure**: Handle stream backpressure properly

## Security Considerations

### Credential Protection

1. **Encryption at Rest**: AES-256-GCM encryption for secretAccessKey
2. **Master Key**: 32-byte key from environment variable
3. **API Masking**: Never return secretAccessKey in API responses
4. **Audit Logging**: Log all credential access attempts

### Access Control

1. **Admin Only**: Storage configuration requires admin role
2. **Company Isolation**: Enforce companyId in all storage operations
3. **Path Validation**: Validate media keys to prevent path traversal

### S3 Bucket Security

1. **IAM Policies**: Recommend least-privilege IAM policies
2. **Bucket Policies**: Suggest private buckets with signed URLs
3. **CORS Configuration**: Document required CORS settings if needed

## Migration Strategy

### Phase 1: Core Infrastructure (MVP)

1. Implement storage driver abstraction
2. Create Local and S3 storage drivers
3. Update saveMediaToFile to use driver factory
4. Implement hybrid GET /public/* endpoint
5. Add storage configuration to Settings

### Phase 2: Security & Configuration

1. Implement credential encryption
2. Add API masking for secrets
3. Create Settings UI for storage configuration
4. Add S3 credential validation
5. Implement audit logging

### Phase 3: Image Optimization

1. Implement image optimization service
2. Add configuration for optimization settings
3. Integrate with saveMediaToFile
4. Add concurrency controls
5. Implement error recovery

### Phase 4: Migration Tools (Optional)

1. Create migration service
2. Add progress reporting
3. Implement optional cleanup
4. Add migration UI/CLI
5. Document migration process

## Deployment Considerations

### Environment Setup

1. Generate and set `STORAGE_CREDENTIALS_KEY`
2. Configure S3 bucket and IAM credentials
3. Set appropriate bucket lifecycle policies
4. Configure CDN if using signed URLs

### Rollback Plan

1. Disable S3 in configuration (revert to local)
2. Existing local files continue working
3. S3 files remain accessible via hybrid mode
4. No data loss during rollback

### Monitoring

1. Log storage operation failures
2. Monitor S3 API call rates and costs
3. Track image optimization performance
4. Alert on encryption key issues

## Future Enhancements

1. **CDN Integration**: Serve media through CDN with signed URLs
2. **Multiple Storage Backends**: Support Azure Blob, Google Cloud Storage
3. **Automatic Cleanup**: Delete old media based on retention policies
4. **Media Analytics**: Track storage usage per company
5. **Thumbnail Generation**: Generate multiple sizes for responsive images
6. **Video Transcoding**: Convert videos to web-friendly formats

## Summary

This design provides a robust, secure, and scalable solution for multi-tenant media storage with S3 compatibility. The architecture follows Clean Architecture and DDD principles, ensuring maintainability and testability. The hybrid mode approach enables zero-downtime migration while the encryption and masking strategies protect sensitive credentials. The phased implementation plan allows for incremental delivery of value while managing complexity.
