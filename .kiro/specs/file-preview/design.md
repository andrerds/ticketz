# Design Document: File Preview System

## Overview

The File Preview System provides a centralized, robust solution for generating and displaying file previews across different storage backends (local filesystem and S3). This system addresses the critical THUMBNAIL_FIX issue by implementing a unified approach to preview URL generation, storage detection, and media serving that works consistently regardless of storage location.

The system integrates seamlessly with the existing s3-media-storage module while maintaining backward compatibility with current media handling. It provides a clean abstraction layer that eliminates the need for storage-specific logic in frontend components.

## Architecture

The File Preview System follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Media Preview   │  │ Thumbnail       │  │ Image Modal  │ │
│  │ Component       │  │ Display         │  │ Component    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Preview         │  │ Thumbnail       │  │ Media        │ │
│  │ Controller      │  │ Controller      │  │ Controller   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Preview URL     │  │ Storage         │  │ Thumbnail    │ │
│  │ Generator       │  │ Detection       │  │ Handler      │ │
│  │ Service         │  │ Service         │  │ Service      │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Storage Driver  │  │ Cache           │  │ Security     │ │
│  │ Factory         │  │ Manager         │  │ Validator    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Core Services

#### StorageDetectionService

Responsible for determining where files are stored and providing unified access patterns.

```typescript
interface IStorageDetectionService {
  detectStorageLocation(
    mediaKey: string,
    companyId: number
  ): Promise<StorageLocation>;
  validateFileExistence(
    mediaKey: string,
    location: StorageLocation
  ): Promise<boolean>;
  getCachedLocation(mediaKey: string): StorageLocation | null;
  setCachedLocation(mediaKey: string, location: StorageLocation): void;
}

type StorageLocation = "local" | "s3";
```

#### PreviewURLGeneratorService

Generates appropriate URLs for file previews based on storage location and security requirements.

```typescript
interface IPreviewURLGeneratorService {
  generatePreviewURL(
    mediaKey: string,
    options: PreviewOptions
  ): Promise<string>;
  generateThumbnailURL(
    mediaKey: string,
    options: ThumbnailOptions
  ): Promise<string>;
  validateURLFormat(url: string): boolean;
  addAuthenticationToken(url: string, companyId: number): string;
}

interface PreviewOptions {
  companyId: number;
  size?: "thumbnail" | "medium" | "full";
  secure?: boolean;
  expirationTime?: number;
}

interface ThumbnailOptions extends PreviewOptions {
  width?: number;
  height?: number;
  quality?: number;
  maintainAspectRatio?: boolean;
}
```

#### ThumbnailHandlerService

Manages thumbnail generation, caching, and serving with fallback strategies.

```typescript
interface IThumbnailHandlerService {
  generateThumbnail(
    mediaKey: string,
    options: ThumbnailOptions
  ): Promise<Buffer>;
  getThumbnail(mediaKey: string, options: ThumbnailOptions): Promise<Buffer>;
  cacheThumbnail(
    mediaKey: string,
    thumbnail: Buffer,
    options: ThumbnailOptions
  ): Promise<void>;
  validateImageFormat(mediaKey: string): Promise<boolean>;
  maintainAspectRatio(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): { width: number; height: number };
}
```

### Controllers

#### PreviewController

Handles HTTP requests for file previews with proper error handling and security validation.

```typescript
interface IPreviewController {
  servePreview(req: Request, res: Response): Promise<void>;
  serveThumbnail(req: Request, res: Response): Promise<void>;
  validatePermissions(req: Request, mediaKey: string): Promise<boolean>;
  setSecurityHeaders(res: Response): void;
  handlePreviewError(error: Error, res: Response): void;
}
```

### Frontend Components

#### MediaPreviewComponent

Unified React component for displaying file previews with automatic storage detection.

```typescript
interface MediaPreviewComponentProps {
  fileId: string;
  companyId: number;
  size?: "thumbnail" | "medium" | "full";
  fallbackComponent?: React.ComponentType;
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
  onError?: (error: Error) => void;
  accessibilityLabel?: string;
}
```

## Data Models

### PreviewCache

Caches preview URLs and metadata to improve performance.

```typescript
interface PreviewCache {
  mediaKey: string;
  storageLocation: StorageLocation;
  previewURL: string;
  thumbnailURL?: string;
  contentType: string;
  fileSize: number;
  lastAccessed: Date;
  expiresAt: Date;
  companyId: number;
}
```

### PreviewMetadata

Stores metadata about file previews and thumbnails.

```typescript
interface PreviewMetadata {
  mediaKey: string;
  originalWidth?: number;
  originalHeight?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  contentType: string;
  fileSize: number;
  hasCustomThumbnail: boolean;
  thumbnailGenerated: boolean;
  lastModified: Date;
  companyId: number;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Storage Detection Properties

**Property 1: Storage location detection consistency**
_For any_ valid media key and company ID, the storage detection service should consistently return the same storage location for the same file across multiple requests within the cache timeout period
**Validates: Requirements 1.1, 1.4**

**Property 2: Local storage priority**
_For any_ file that exists in both local and S3 storage, the storage detection service should always prioritize local storage access
**Validates: Requirements 1.2**

**Property 3: File existence validation**
_For any_ storage location confirmation, the storage detection service should validate file existence before confirming the location
**Validates: Requirements 1.5**

**Property 4: Graceful error handling**
_For any_ storage detection failure, the system should return a graceful error response without exposing internal system details
**Validates: Requirements 1.3**

### URL Generation Properties

**Property 5: S3 URL format consistency**
_For any_ file stored in S3, the preview URL generator should create URLs using the S3 endpoint format with proper authentication
**Validates: Requirements 2.1, 2.3**

**Property 6: Local URL format consistency**
_For any_ file stored locally, the preview URL generator should create URLs using the application host format
**Validates: Requirements 2.2**

**Property 7: URL format validation**
_For any_ generated preview URL, the system should validate the URL format before returning it to the client
**Validates: Requirements 2.5**

**Property 8: Cross-file-type URL consistency**
_For any_ set of files with different types but same storage location, the URL format pattern should remain consistent
**Validates: Requirements 2.4**

### Thumbnail Processing Properties

**Property 9: Thumbnail generation fallback**
_For any_ image file without an existing thumbnail, the thumbnail handler should generate one from the original file if the format is supported
**Validates: Requirements 3.2**

**Property 10: Original file fallback**
_For any_ thumbnail generation failure, the thumbnail handler should serve the original file as fallback
**Validates: Requirements 3.3**

**Property 11: Aspect ratio preservation**
_For any_ thumbnail generation request, the thumbnail handler should maintain the original aspect ratio unless explicitly configured otherwise
**Validates: Requirements 3.4**

**Property 12: Content-Type header consistency**
_For any_ served thumbnail, the system should set appropriate Content-Type headers based on the actual file format
**Validates: Requirements 3.5**

### Performance Properties

**Property 13: Caching effectiveness**
_For any_ frequently accessed preview, the system should implement caching mechanisms that reduce subsequent access times
**Validates: Requirements 4.1**

**Property 14: S3 streaming efficiency**
_For any_ file served from S3, the system should stream content directly without storing it locally
**Validates: Requirements 4.2**

**Property 15: Local streaming efficiency**
_For any_ file served from local storage, the system should use efficient file streaming mechanisms
**Validates: Requirements 4.3**

**Property 16: Image compression appropriateness**
_For any_ preview image above a size threshold, the system should apply appropriate compression to reduce bandwidth usage
**Validates: Requirements 4.4**

**Property 17: Concurrent access handling**
_For any_ set of simultaneous preview requests, the system should handle concurrent access without performance degradation
**Validates: Requirements 4.5**

### Frontend Component Properties

**Property 18: Automatic storage detection**
_For any_ file identifier provided to the media preview component, it should automatically handle storage detection without requiring storage-specific configuration
**Validates: Requirements 5.1**

**Property 19: Loading state consistency**
_For any_ preview loading operation, the media preview component should show appropriate loading states during content retrieval
**Validates: Requirements 5.2**

**Property 20: Error placeholder display**
_For any_ preview loading failure, the media preview component should display appropriate error placeholders
**Validates: Requirements 5.3**

**Property 21: Size support completeness**
_For any_ supported preview size (thumbnail, medium, full), the media preview component should handle the request appropriately
**Validates: Requirements 5.4**

**Property 22: Accessibility compliance**
_For any_ displayed preview, the media preview component should provide required accessibility attributes for screen readers
**Validates: Requirements 5.5**

### Error Handling Properties

**Property 23: Error logging completeness**
_For any_ storage access failure, the system should log detailed error information sufficient for debugging
**Validates: Requirements 6.1**

**Property 24: Fallback strategy execution**
_For any_ preview generation error, the system should attempt all configured fallback strategies before failing
**Validates: Requirements 6.2**

**Property 25: Circuit breaker functionality**
_For any_ external storage access pattern, the system should implement circuit breaker patterns to prevent cascade failures
**Validates: Requirements 6.3**

**Property 26: Standardized error responses**
_For any_ error condition, the system should return standardized error responses with appropriate HTTP status codes
**Validates: Requirements 6.4**

**Property 27: Health metrics collection**
_For any_ preview system operation, the system should monitor and report relevant health metrics
**Validates: Requirements 6.5**

### Security Properties

**Property 28: Permission validation**
_For any_ preview request, the system should validate user permissions before serving content
**Validates: Requirements 7.1**

**Property 29: Signed URL expiration**
_For any_ S3 signed URL generation, the system should set appropriate expiration times based on security configuration
**Validates: Requirements 7.2**

**Property 30: Path sanitization**
_For any_ file path input, the system should sanitize paths to prevent directory traversal attacks
**Validates: Requirements 7.3**

**Property 31: Security header inclusion**
_For any_ preview response, the system should include security headers to prevent content injection attacks
**Validates: Requirements 7.4**

**Property 32: Access audit logging**
_For any_ preview access attempt, the system should log the attempt for security auditing purposes
**Validates: Requirements 7.5**

### Integration Properties

**Property 33: Backward compatibility preservation**
_For any_ existing media URL format, the system should maintain backward compatibility
**Validates: Requirements 8.1**

**Property 34: Storage configuration reuse**
_For any_ integration with s3-media-storage module, the system should reuse existing storage configuration
**Validates: Requirements 8.2**

**Property 35: Media key format preservation**
_For any_ existing media key format, the system should preserve the format and naming conventions
**Validates: Requirements 8.3**

**Property 36: Legacy file handling**
_For any_ legacy media file without preview metadata, the system should handle it gracefully
**Validates: Requirements 8.4**

**Property 37: Migration support**
_For any_ existing media file, the system should support migration to include preview capabilities
**Validates: Requirements 8.5**

## Error Handling

The File Preview System implements comprehensive error handling with multiple fallback strategies:

### Error Categories

1. **Storage Access Errors**: Network failures, permission issues, file not found
2. **Thumbnail Generation Errors**: Unsupported formats, memory issues, processing failures
3. **URL Generation Errors**: Invalid paths, authentication failures, configuration issues
4. **Frontend Display Errors**: Network timeouts, CORS issues, rendering failures

### Fallback Strategies

1. **Storage Fallback**: Local → S3 → Error placeholder
2. **Thumbnail Fallback**: Cached thumbnail → Generated thumbnail → Original file → Placeholder
3. **URL Fallback**: Direct URL → Signed URL → Proxy URL → Error response
4. **Display Fallback**: Full preview → Thumbnail → Placeholder → Error message

### Circuit Breaker Implementation

The system implements circuit breaker patterns for external storage access:

- **Closed State**: Normal operation, requests pass through
- **Open State**: Fast-fail mode, immediate error responses
- **Half-Open State**: Limited requests to test recovery

## Testing Strategy

The File Preview System uses a dual testing approach combining unit tests and property-based tests:

### Unit Testing

- Specific examples of preview generation for known file types
- Edge cases like empty files, corrupted images, invalid paths
- Integration points between storage detection and URL generation
- Error conditions and fallback behavior verification

### Property-Based Testing

- **Testing Framework**: fast-check for TypeScript/JavaScript
- **Minimum Iterations**: 100 per property test
- **Property Test Tagging**: Each test tagged with format `**Feature: file-preview, Property {number}: {property_text}**`

Property-based tests verify universal properties across all valid inputs:

- Storage detection consistency across random file paths
- URL format validation across different storage configurations
- Thumbnail generation behavior across various image formats
- Error handling consistency across different failure scenarios
- Security validation across various malicious inputs

The combination ensures both concrete functionality and general correctness across the entire input space.
