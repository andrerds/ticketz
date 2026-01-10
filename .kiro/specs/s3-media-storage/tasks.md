# Implementation Plan: S3-Compatible Media Storage System

## Overview

This implementation plan breaks down the S3 media storage feature into incremental, testable tasks. Each task builds on previous work and includes specific requirements references. The plan follows a phased approach to deliver value incrementally while maintaining system stability.

## Task List

- [x] 1. Set up core storage infrastructure

  - Create domain layer interfaces and value objects for storage abstraction
  - Implement encryption service for credential protection
  - Set up AWS SDK dependencies
  - _Requirements: 2.5, 6.1_

- [x] 1.1 Create storage driver interface

  - Define IStorageDriver interface with write, read, exists, delete, and getSignedUrl methods
  - Create StorageConfig value object with validation
  - Implement StorageConfig.maskSecrets() method
  - _Requirements: 2.5, 1.4_

- [x] 1.2 Implement credential encryption service

  - Create EncryptionService with AES-256-GCM encryption
  - Implement encrypt() and decrypt() methods
  - Add validation for master key format (64 hex characters)
  - _Requirements: 1.3, 6.1_

- [x] 1.3 Write property test for encryption round-trip

  - **Property 3: Credential encryption**
  - **Validates: Requirements 1.3, 6.1**

- [x] 1.4 Add AWS SDK dependencies

  - Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
  - Update package.json and package-lock.json
  - _Requirements: 1.5_

- [x] 2. Implement storage drivers

  - Create LocalStorageDriver using existing filesystem logic
  - Create S3StorageDriver with AWS SDK integration
  - Implement StorageDriverFactory with caching
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2.1 Implement LocalStorageDriver

  - Create LocalStorageDriver class implementing IStorageDriver
  - Implement write() using @flystorage/file-storage
  - Implement read() returning file stream
  - Implement exists() checking filesystem
  - Implement delete() removing file
  - Return null for getSignedUrl() (not supported)
  - _Requirements: 2.2_

- [x] 2.2 Write property test for LocalStorageDriver

  - **Property 7: Media key format consistency**
  - **Validates: Requirements 2.2**

- [x] 2.3 Implement S3StorageDriver

  - Create S3StorageDriver class implementing IStorageDriver
  - Initialize S3Client with configuration
  - Implement write() using PutObjectCommand
  - Implement read() using GetObjectCommand
  - Implement exists() using HeadObjectCommand
  - Implement delete() using DeleteObjectCommand
  - Implement getSignedUrl() using getSignedUrl helper
  - Handle prefix configuration for key paths
  - _Requirements: 1.5, 2.2_

- [x] 2.4 Write property test for S3 key format consistency

  - **Property 7: Media key format consistency**
  - **Validates: Requirements 2.2**

- [x] 2.5 Implement StorageDriverFactory

  - Create factory with createDriver() method
  - Implement driver selection based on StorageConfig
  - Add caching with 5-minute TTL using SimpleObjectCache
  - Implement clearCache() method
  - _Requirements: 2.1, 2.4_

- [x] 2.6 Write property test for driver selection

  - **Property 6: Storage driver selection**
  - **Validates: Requirements 2.1**

- [x] 2.7 Write property test for configuration caching

  - **Property 9: Configuration caching**
  - **Validates: Requirements 2.4**

- [x] 3. Create storage configuration services

  - Implement service to retrieve storage config from Settings
  - Add S3 credential validation
  - Implement config encryption/decryption
  - _Requirements: 1.2, 1.3, 1.4, 6.2, 6.3_

- [x] 3.1 Implement GetStorageConfigService

  - Create service to fetch storage settings by companyId
  - Parse storageDriver, storageS3Config, storageImageOptimization from Settings
  - Decrypt secretAccessKey using EncryptionService
  - Return StorageConfig instance
  - Cache configuration with SimpleObjectCache
  - _Requirements: 1.5, 2.4_

- [x] 3.2 Write property test for default storage driver

  - **Property 1: Default storage driver**
  - **Validates: Requirements 1.1**

- [x] 3.3 Implement ValidateS3ConfigService

  - Create service to validate S3 credentials
  - Test connectivity by attempting to list bucket
  - Return specific error messages for auth failures, bucket not found, network errors
  - Implement dry-run mode that skips persistence
  - _Requirements: 1.2, 6.3, 7.1, 7.2, 7.3, 10.3_

- [x] 3.4 Write property test for S3 credential validation

  - **Property 2: S3 credential validation**
  - **Validates: Requirements 1.2, 6.3**

- [x] 3.5 Write property test for dry-run validation

  - **Property 27: Dry-run validation**
  - **Validates: Requirements 10.3**

- [x] 3.4 Implement UpdateStorageConfigService

  - Create service to save storage configuration
  - Validate required fields for S3 config
  - Encrypt secretAccessKey before saving
  - Call ValidateS3ConfigService before persisting
  - Clear driver cache after update
  - Emit socket event for config update
  - _Requirements: 1.2, 1.3, 8.3_

- [x] 3.5 Write property test for S3 configuration persistence

  - **Property 5: S3 configuration persistence**
  - **Validates: Requirements 1.5**

- [x] 3.6 Write property test for required field validation

  - **Property 23: Required field validation**
  - **Validates: Requirements 8.3**

- [x] 3.6 Implement credential masking in API responses

  - Update ListSettingsService to mask secretAccessKey
  - Update GetSettingService to mask secretAccessKey
  - Ensure masked value is **\*** for display
  - _Requirements: 1.4, 6.2_

- [x] 3.7 Write property test for secret masking

  - **Property 4: Secret masking in API responses**
  - **Validates: Requirements 1.4, 6.2**

- [x] 4. Update media upload flow

  - Refactor saveMediaToFile to use storage drivers
  - Maintain existing media key format
  - Add error handling for storage failures
  - _Requirements: 2.1, 2.2, 2.3, 7.5_

- [x] 4.1 Refactor saveMediaToFile helper

  - Import GetStorageConfigService and StorageDriverFactory
  - Get storage config based on companyId
  - Create appropriate storage driver
  - Use driver.write() instead of direct filesystem write
  - Maintain existing media key format (media/{companyId}/{contactId}/{ticketId}/{randomId}/{filename})
  - Add try-catch with clear error messages
  - _Requirements: 2.1, 2.2_

- [x] 4.2 Write property test for storage driver usage

  - **Property 6: Storage driver selection**
  - **Property 15: New media storage location**
  - **Validates: Requirements 2.1, 4.2**

- [x] 4.3 Write property test for error handling

  - **Property 8: Storage operation error handling**
  - **Validates: Requirements 2.3**

- [x] 4.3 Update wbotMessageListener media handling

  - Ensure downloadMedia continues to work with new saveMediaToFile
  - Verify thumbnail handling works correctly
  - Test with various media types (image, video, audio, document)
  - _Requirements: 2.1_

- [x] 4.4 Write property test for upload failure prevention

  - **Property 22: Upload failure prevents message creation**
  - **Validates: Requirements 7.5**

- [x] 5. Implement hybrid media serving

  - Update GET /public/\* endpoint to support fallback to S3
  - Check local filesystem first, then S3
  - Stream files efficiently
  - Set appropriate Content-Type headers
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 4.1, 4.3_

- [x] 5.1 Create MediaController with serve method

  - Create new controller for GET /public/\* endpoint
  - Extract media key from request path
  - Check if file exists locally using fs.access()
  - If local file exists, stream it with appropriate Content-Type
  - If not local, get storage config and create S3 driver
  - Stream from S3 with appropriate Content-Type
  - Return 404 if file not found in either location
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 5.2 Write property test for local filesystem priority

  - **Property 11: Local filesystem priority**
  - **Property 16: Local precedence in hybrid mode**
  - **Validates: Requirements 3.2, 4.3**

- [x] 5.3 Write property test for S3 fallback

  - **Property 12: S3 fallback retrieval**
  - **Validates: Requirements 3.3**

- [x] 5.4 Write property test for Content-Type headers

  - **Property 13: Content-Type headers**
  - **Validates: Requirements 3.4**

- [x] 5.2 Update app.ts to use MediaController

  - Replace existing GET /public/\* handler with MediaController.serve
  - Maintain backward compatibility for .aac files
  - Keep error handling for ENOENT and other errors
  - _Requirements: 3.2, 3.3_

- [x] 5.3 Write property test for backward compatibility

  - **Property 14: Backward compatibility**
  - **Validates: Requirements 4.1**

- [x] 6. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement image optimization

  - Create OptimizeImageService using sharp
  - Add configuration for maxWidth, quality, maxBytes
  - Implement concurrency control
  - Add error recovery (save original on failure)
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 7.1 Create OptimizeImageService

  - Create service with optimizeImage() method
  - Check if file is image/\* mimetype
  - Check if file size exceeds threshold
  - Use sharp to resize (maxWidth) and compress (quality)
  - Implement concurrency limit using async-mutex (max 2 concurrent)
  - Return optimized buffer or original on failure
  - Log optimization results (original size vs optimized size)
  - _Requirements: 5.1, 5.2_

- [x] 7.2 Write property test for image-only optimization

  - **Property 18: Image-only optimization**
  - **Validates: Requirements 5.1**

- [x] 7.3 Write property test for size-based optimization

  - **Property 19: Size-based optimization**
  - **Validates: Requirements 5.2**

- [x] 7.4 Write property test for optimization failure recovery

  - **Property 20: Optimization failure recovery**
  - **Validates: Requirements 5.4**

- [x] 7.2 Integrate optimization into saveMediaToFile

  - Get image optimization config from storage settings
  - Call OptimizeImageService before writing to storage
  - Use optimized buffer if successful, original if not
  - Update media.data with optimized buffer
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 8. Create storage configuration UI

  - Add storage section to Settings page
  - Create form for S3 configuration
  - Implement credential masking in UI
  - Add validation and error display
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8.1 Add storage settings to backend API

  - Create GET /api/settings/storage endpoint
  - Create PUT /api/settings/storage endpoint
  - Return masked secretAccessKey in GET response
  - Validate S3 config before saving in PUT
  - _Requirements: 1.4, 8.3_

- [x] 8.2 Create StorageSettings component

  - Create new component in frontend/src/components/Settings/
  - Add driver selection radio buttons (Local / S3)
  - Show S3 fields conditionally when S3 is selected
  - Add fields: endpoint, region, bucket, accessKeyId, secretAccessKey, prefix
  - Mask secretAccessKey display (show **\*** for existing values)
  - Add image optimization toggle and fields (maxWidth, quality, maxBytes)
  - Implement form validation
  - Show success/error messages
  - _Requirements: 8.1, 8.2, 8.4, 8.5_

- [x] 8.3 Integrate StorageSettings into Settings page

  - Add StorageSettings component to SettingsCustom page
  - Add navigation tab for "Storage"
  - Ensure proper permissions (admin only)
  - _Requirements: 8.1_

- [ ] 9. Implement media management features

  - Create media management page with file listing
  - Implement filtering by date, type, location
  - Add 30-day protection rule
  - Implement delete functionality with placeholder
  - Add storage statistics
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

- [x] 9.1 Create media management services

  - Implement ListMediaFilesService with filtering
  - Implement GetMediaStatsService for storage statistics
  - Implement DeleteMediaFileService with 30-day check
  - Implement BulkDeleteMediaFilesService
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.9_

- [x] 9.2 Write property test for media grouping

  - **Property 28: Media grouping by date and type**
  - **Validates: Requirements 11.1**

- [x] 9.3 Write property test for media information completeness

  - **Property 29: Media information completeness**
  - **Validates: Requirements 11.2**

- [x] 9.4 Write property test for age-based deletion

  - **Property 30: Age-based deletion permission**
  - **Property 31: Recent file protection**
  - **Validates: Requirements 11.3, 11.4**

- [x] 9.5 Write property test for deleted media marking

  - **Property 32: Deleted media marking**
  - **Validates: Requirements 11.5**

- [ ] 9.6 Write property test for media filtering

  - **Property 34: Media filtering**
  - **Validates: Requirements 11.7**

- [ ] 9.7 Write property test for bulk deletion

  - **Property 35: Bulk deletion processing**
  - **Property 36: Deletion error resilience**
  - **Validates: Requirements 11.8, 11.9**

- [ ] 9.8 Write property test for storage statistics

  - **Property 37: Storage usage statistics**
  - **Validates: Requirements 11.10**

- [x] 9.2 Create media management API endpoints

  - Add GET /api/media endpoint with query params for filters
  - Add GET /api/media/stats endpoint
  - Add DELETE /api/media/:messageId endpoint
  - Add POST /api/media/bulk-delete endpoint
  - Add proper authentication and authorization
  - _Requirements: 11.1, 11.2, 11.3, 11.9_

- [x] 9.3 Create MediaManagement page component

  - Create new page in frontend/src/pages/MediaManagement/
  - Add MediaFilters component (date range, type, location)
  - Add MediaStats component (total usage, breakdown by type)
  - Add MediaFileList component with cards
  - Show delete button only for files > 30 days old
  - Add bulk selection and bulk delete
  - Add DeleteConfirmationDialog
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.8_

- [x] 9.4 Implement deleted media placeholder

  - Update Message display components to check isDeleted flag
  - Show placeholder image/text when media is deleted
  - Add tooltip explaining media was manually removed
  - _Requirements: 11.5, 11.6_

- [x] 9.5 Write property test for placeholder display

  - **Property 33: Deleted media placeholder**
  - **Validates: Requirements 11.6**

- [x] 9.5 Add media management to navigation

  - Add "Media Management" menu item to admin navigation
  - Ensure proper permissions (admin only)
  - _Requirements: 11.1_

- [ ] 10. Implement migration utility

  - Create service to migrate local files to S3
  - Preserve media keys during migration
  - Add progress reporting
  - Implement optional cleanup
  - Add error resilience
  - _Requirements: 4.5, 9.1, 9.2, 9.3, 9.4_

- [ ] 10.1 Create MigrateMediaService

  - Create service with migrateCompanyMedia() method
  - Enumerate all local media files for company
  - For each file, upload to S3 with same key
  - Optionally delete local file after successful upload
  - Track progress (processed, succeeded, failed)
  - Log failed files and continue with remaining
  - Return migration report
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10.2 Write property test for migration key preservation

  - **Property 17: Migration key preservation**
  - **Validates: Requirements 4.5, 9.2**

- [ ] 10.3 Write property test for migration completeness

  - **Property 24: Migration completeness**
  - **Validates: Requirements 9.1**

- [ ] 10.4 Write property test for migration cleanup

  - **Property 25: Migration optional cleanup**
  - **Validates: Requirements 9.3**

- [ ] 10.5 Write property test for migration error resilience

  - **Property 26: Migration error resilience**
  - **Validates: Requirements 9.4**

- [ ] 10.2 Create migration API endpoint

  - Add POST /api/media/migrate endpoint
  - Accept companyId and deleteLocal flag
  - Return migration progress/report
  - Add proper authentication (super admin only)
  - _Requirements: 9.1, 9.3_

- [ ] 10.3 Create migration UI component

  - Add migration section to StorageSettings
  - Show current storage usage (local vs S3)
  - Add "Migrate to S3" button
  - Show progress bar during migration
  - Display migration report (succeeded, failed)
  - Add checkbox for "Delete local files after migration"
  - _Requirements: 9.1, 9.3, 9.5_

- [ ] 11. Add audit logging

  - Implement logging for credential access
  - Log storage configuration changes
  - Log media deletions
  - _Requirements: 6.5_

- [ ] 11.1 Implement audit logging service

  - Create AuditLogService with log() method
  - Log credential access events
  - Log storage config updates
  - Log media file deletions
  - Include userId, companyId, action, timestamp
  - _Requirements: 6.5_

- [ ] 11.2 Write property test for audit logging

  - **Property 21: Audit logging**
  - **Validates: Requirements 6.5**

- [ ] 11.2 Integrate audit logging

  - Add logging to GetStorageConfigService
  - Add logging to UpdateStorageConfigService
  - Add logging to DeleteMediaFileService
  - _Requirements: 6.5_

- [ ] 12. Final checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Documentation and deployment preparation

  - Create migration guide
  - Document S3 bucket setup
  - Document IAM policy requirements
  - Add environment variable documentation
  - Create rollback procedure
  - _Requirements: All_

- [ ] 13.1 Create deployment documentation

  - Document STORAGE_CREDENTIALS_KEY generation
  - Document S3 bucket creation and configuration
  - Document IAM user/role setup with minimal permissions
  - Document environment variables
  - Create step-by-step migration guide
  - Document rollback procedure
  - _Requirements: All_

- [ ] 13.2 Add inline code documentation
  - Add JSDoc comments to all public interfaces
  - Document error codes and their meanings
  - Add usage examples in comments
  - _Requirements: All_

## Notes

- Each task should be completed and tested before moving to the next
- Property-based tests should run a minimum of 100 iterations
- All storage operations should include proper error handling
- Security is critical - never expose secretAccessKey in logs or API responses
- Maintain backward compatibility throughout implementation
- Test with multiple companies to ensure proper multi-tenant isolation
