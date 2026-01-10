# Requirements Document

## Introduction

This document specifies the requirements for implementing a flexible media storage system that supports both local filesystem and S3-compatible storage (AWS S3, MinIO, Cloudflare R2, etc.) for the Ticketz application. The system must maintain backward compatibility with existing local media files while enabling companies to migrate to cloud storage with optional image optimization to reduce costs and bandwidth usage.

## Glossary

- **Storage Driver**: The backend mechanism responsible for persisting media files (Local or S3-Compatible)
- **Media File**: Any file uploaded or received through the system (images, videos, audio, documents)
- **Company**: A tenant in the multi-tenant system, identified by companyId
- **Message**: A database record containing references to media files via mediaUrl and thumbnailUrl
- **S3-Compatible Storage**: Any object storage service that implements the S3 API (AWS S3, MinIO, Cloudflare R2, Backblaze B2)
- **Media Key**: The path/identifier used to locate a media file (e.g., media/1/10/200/abc123/file.jpg)
- **Hybrid Mode**: Operating mode where the system serves both local and S3-stored media transparently
- **Image Optimization**: Process of resizing and compressing images to reduce file size and storage costs
- **Secret Masking**: Security practice of never returning sensitive credentials in API responses
- **Storage Configuration**: Company-specific settings defining storage driver and credentials

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to configure storage backend per company, so that different tenants can use different storage solutions based on their needs and budget.

#### Acceptance Criteria

1. WHEN a company is created THEN the system SHALL default to local storage driver
2. WHEN an administrator updates storage configuration THEN the system SHALL validate S3 credentials before saving
3. WHEN storage configuration is saved THEN the system SHALL encrypt sensitive credentials using AES-256-GCM
4. WHEN storage configuration is retrieved THEN the system SHALL never return the secretAccessKey value
5. WHERE S3 storage is configured, the system SHALL store endpoint, region, bucket, accessKeyId, forcePathStyle, and prefix settings

### Requirement 2

**User Story:** As a developer, I want a unified storage abstraction layer, so that the application code doesn't need to know whether files are stored locally or in S3.

#### Acceptance Criteria

1. WHEN saving a media file THEN the system SHALL determine the storage driver based on company configuration
2. WHEN saving to S3 THEN the system SHALL use the same media key format as local storage
3. WHEN a storage operation fails THEN the system SHALL throw a clear error indicating the failure reason
4. WHEN retrieving storage configuration THEN the system SHALL cache it to avoid repeated database queries
5. THE system SHALL provide a single interface for write, read, and delete operations across all storage drivers

### Requirement 3

**User Story:** As an end user, I want to access media files through the same URLs regardless of storage backend, so that the user experience remains consistent.

#### Acceptance Criteria

1. WHEN a message contains media THEN the Message model SHALL return URLs in the format BACKEND_URL/public/<key>
2. WHEN the GET /public/* endpoint receives a request THEN the system SHALL first check local filesystem
3. IF the file does not exist locally THEN the system SHALL retrieve it from the configured S3 storage
4. WHEN streaming from S3 THEN the system SHALL set appropriate Content-Type headers
5. WHEN a file is not found in either storage THEN the system SHALL return HTTP 404

### Requirement 4

**User Story:** As a system administrator, I want existing local media files to continue working after enabling S3, so that migration can happen gradually without downtime.

#### Acceptance Criteria

1. WHEN S3 storage is enabled THEN the system SHALL continue serving existing local files
2. WHEN new media is uploaded THEN the system SHALL store it in the configured storage driver
3. WHEN a file exists in both local and S3 storage THEN the system SHALL prioritize local filesystem
4. THE system SHALL support hybrid mode where old files remain local and new files go to S3
5. THE system SHALL provide a migration utility to move local files to S3 while preserving media keys

### Requirement 5

**User Story:** As a system administrator, I want to optimize images automatically, so that storage costs and bandwidth usage are reduced without manual intervention.

#### Acceptance Criteria

1. WHEN image optimization is enabled THEN the system SHALL only process files with image/* mimetype
2. WHEN an image exceeds the configured size threshold THEN the system SHALL resize and compress it
3. WHEN optimizing images THEN the system SHALL limit concurrent operations to prevent CPU overload
4. WHEN optimization fails THEN the system SHALL save the original file and log the error
5. WHERE optimization is configured, the system SHALL support settings for maxWidth, quality, and maxBytes

### Requirement 6

**User Story:** As a security-conscious administrator, I want S3 credentials to be stored securely, so that unauthorized users cannot access sensitive cloud storage credentials.

#### Acceptance Criteria

1. WHEN S3 credentials are saved THEN the system SHALL encrypt the secretAccessKey using a master key from environment
2. WHEN retrieving settings via API THEN the system SHALL mask the secretAccessKey field
3. WHEN validating S3 configuration THEN the system SHALL test connectivity before persisting credentials
4. WHEN encryption key is missing THEN the system SHALL fail fast with a clear error message
5. THE system SHALL log all access to storage credentials for audit purposes

### Requirement 7

**User Story:** As a developer, I want clear error messages when storage operations fail, so that I can quickly diagnose and fix issues.

#### Acceptance Criteria

1. WHEN S3 credentials are invalid THEN the system SHALL return a specific error indicating authentication failure
2. WHEN S3 bucket does not exist THEN the system SHALL return an error indicating the bucket is not found
3. WHEN network connectivity fails THEN the system SHALL return a timeout error with retry suggestion
4. WHEN disk space is exhausted THEN the system SHALL return an error indicating insufficient storage
5. WHEN media upload fails THEN the system SHALL prevent message creation and return the error to the client

### Requirement 8

**User Story:** As a system administrator, I want to configure storage settings through the existing Settings UI, so that I can manage storage without modifying code or database directly.

#### Acceptance Criteria

1. WHEN accessing Settings page THEN the system SHALL display a Storage section with driver selection
2. WHEN S3 driver is selected THEN the system SHALL show fields for endpoint, region, bucket, accessKeyId, secretAccessKey, and prefix
3. WHEN saving S3 configuration THEN the system SHALL validate all required fields are present
4. WHEN displaying saved configuration THEN the system SHALL show secretAccessKey as masked (e.g., *****)
5. WHEN image optimization is enabled THEN the system SHALL show fields for maxWidth, quality, and maxBytes

### Requirement 9

**User Story:** As a system operator, I want to migrate existing local media to S3, so that I can consolidate storage and reduce local disk usage.

#### Acceptance Criteria

1. WHEN migration is initiated THEN the system SHALL enumerate all local media files for the company
2. WHEN uploading to S3 THEN the system SHALL preserve the original media key
3. WHEN migration completes successfully THEN the system SHALL optionally delete local files
4. WHEN migration encounters errors THEN the system SHALL log failed files and continue with remaining files
5. THE system SHALL provide progress reporting during migration

### Requirement 10

**User Story:** As a developer, I want the storage system to be testable, so that I can verify functionality without requiring actual S3 infrastructure.

#### Acceptance Criteria

1. WHEN running tests THEN the system SHALL support a mock storage driver
2. WHEN testing S3 operations THEN the system SHALL allow dependency injection of S3 client
3. WHEN validating storage configuration THEN the system SHALL provide a dry-run mode
4. THE system SHALL include unit tests for storage driver selection logic
5. THE system SHALL include integration tests for hybrid mode file serving

### Requirement 11

**User Story:** As a system administrator, I want to view and manually manage media files by date and type, so that I can free up storage space by removing old files while protecting recent content.

#### Acceptance Criteria

1. WHEN accessing the media management page THEN the system SHALL display all media files for the company grouped by date and file type
2. WHEN viewing media files THEN the system SHALL show file name, size, upload date, message reference, and storage location
3. WHEN a file is older than 30 days THEN the system SHALL allow the administrator to delete it
4. WHEN a file is newer than 30 days THEN the system SHALL prevent deletion and display a protection message
5. WHEN a media file is deleted THEN the system SHALL mark the message mediaUrl as deleted and display a placeholder in the UI
6. WHEN viewing a message with deleted media THEN the system SHALL show a placeholder indicating the media was manually removed
7. WHEN filtering media files THEN the system SHALL support filtering by date range, file type, and storage location
8. WHEN deleting multiple files THEN the system SHALL provide bulk deletion with confirmation dialog
9. WHEN a deletion operation fails THEN the system SHALL log the error and continue with remaining files
10. THE system SHALL display total storage usage statistics per company with breakdown by file type

## Summary

This requirements document establishes the foundation for a flexible, secure, and backward-compatible media storage system. The implementation will enable companies to choose between local and S3-compatible storage while maintaining seamless user experience and providing tools for gradual migration. Security, performance, and maintainability are core considerations throughout the design.
