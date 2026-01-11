# Implementation Plan: File Preview System

## Overview

This implementation plan transforms the file preview design into a series of incremental coding tasks that build upon each other. The plan focuses on resolving the THUMBNAIL_FIX issue while creating a robust, unified preview system that works seamlessly with both S3 and local storage.

Each task is designed to be executed by a coding agent and includes specific requirements references. The implementation follows a bottom-up approach, building core services first, then controllers, and finally frontend components.

## Task List

- [x] 1. Set up core preview system infrastructure

  - Create domain interfaces and value objects for preview system
  - Set up TypeScript types and enums for storage locations
  - Create base error classes for preview system
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 1.1 Create preview system domain interfaces

  - Define IStorageDetectionService interface with detectStorageLocation, validateFileExistence, getCachedLocation methods
  - Define IPreviewURLGeneratorService interface with generatePreviewURL, generateThumbnailURL, validateURLFormat methods
  - Define IThumbnailHandlerService interface with generateThumbnail, getThumbnail, cacheThumbnail methods
  - Create StorageLocation type ('local' | 's3')
  - Create PreviewOptions and ThumbnailOptions interfaces
  - _Requirements: 1.1, 2.1, 3.1_

- [ ]\* 1.2 Write property test for interface compliance

  - **Property 1: Storage location detection consistency**
  - **Validates: Requirements 1.1, 1.4**

- [x] 1.3 Create preview system value objects and types

  - Create PreviewCache interface with mediaKey, storageLocation, previewURL fields
  - Create PreviewMetadata interface with dimensions, contentType, fileSize fields
  - Create PreviewError class extending AppError with specific error codes
  - Create PreviewSize enum ('thumbnail', 'medium', 'full')
  - _Requirements: 1.1, 2.1, 3.1_

- [ ]\* 1.4 Write property test for value object validation

  - **Property 7: URL format validation**
  - **Validates: Requirements 2.5**

- [x] 2. Implement storage detection service

  - Create service to detect file storage location with caching
  - Integrate with existing s3-media-storage configuration
  - Implement file existence validation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2.1 Implement StorageDetectionService

  - Create StorageDetectionService class implementing IStorageDetectionService
  - Implement detectStorageLocation method that checks local filesystem first, then S3
  - Use GetStorageConfigService to determine if S3 is configured
  - Implement file existence validation using fs.access for local, HeadObjectCommand for S3
  - Add SimpleObjectCache for caching storage location results (5-minute TTL)
  - _Requirements: 1.1, 1.2, 1.5_

- [ ]\* 2.2 Write property test for local storage priority

  - **Property 2: Local storage priority**
  - **Validates: Requirements 1.2**

- [ ]\* 2.3 Write property test for file existence validation

  - **Property 3: File existence validation**
  - **Validates: Requirements 1.5**

- [x] 2.4 Implement storage detection caching

  - Add getCachedLocation and setCachedLocation methods
  - Implement cache key generation based on mediaKey and companyId
  - Add cache invalidation logic for file updates
  - Add logging for cache hits and misses
  - _Requirements: 1.4_

- [ ]\* 2.5 Write property test for caching effectiveness

  - **Property 13: Caching effectiveness**
  - **Validates: Requirements 4.1**

- [x] 2.6 Add graceful error handling to storage detection

  - Implement try-catch blocks with specific error types
  - Add fallback logic when both storage locations fail
  - Ensure no internal system details are exposed in error messages
  - Add comprehensive logging for debugging
  - _Requirements: 1.3_

- [ ]\* 2.7 Write property test for graceful error handling

  - **Property 4: Graceful error handling**
  - **Validates: Requirements 1.3**

- [x] 3. Implement preview URL generation service

  - Create service to generate appropriate URLs based on storage location
  - Add authentication token support for secure access
  - Implement URL format validation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.1 Implement PreviewURLGeneratorService

  - Create PreviewURLGeneratorService class implementing IPreviewURLGeneratorService
  - Implement generatePreviewURL method that creates URLs based on storage location
  - For S3: use getSignedUrl with appropriate expiration times
  - For local: use application host with /public/media/ prefix
  - Add support for different preview sizes in URL parameters
  - _Requirements: 2.1, 2.2_

- [ ]\* 3.2 Write property test for S3 URL format

  - **Property 5: S3 URL format consistency**
  - **Validates: Requirements 2.1, 2.3**

- [ ]\* 3.3 Write property test for local URL format

  - **Property 6: Local URL format consistency**
  - **Validates: Requirements 2.2**

- [x] 3.4 Implement authentication token support

  - Add addAuthenticationToken method for secure URL generation
  - Implement JWT token generation for preview access
  - Add token validation middleware for preview endpoints
  - Set appropriate expiration times based on security configuration
  - _Requirements: 2.3, 7.1, 7.2_

- [ ]\* 3.5 Write property test for authentication tokens

  - **Property 28: Permission validation**
  - **Validates: Requirements 7.1**

- [x] 3.6 Implement URL format validation and consistency

  - Add validateURLFormat method with comprehensive URL validation
  - Ensure consistent URL patterns across different file types
  - Add URL sanitization to prevent injection attacks
  - Implement URL format testing for various edge cases
  - _Requirements: 2.4, 2.5, 7.3_

- [ ]\* 3.7 Write property test for URL format consistency

  - **Property 8: Cross-file-type URL consistency**
  - **Validates: Requirements 2.4**

- [x] 4. Implement thumbnail handler service

  - Create service for thumbnail generation and management
  - Add support for multiple image formats
  - Implement fallback strategies for thumbnail failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.1 Implement ThumbnailHandlerService

  - Create ThumbnailHandlerService class implementing IThumbnailHandlerService
  - Implement generateThumbnail method using sharp library
  - Support common image formats (JPEG, PNG, WebP, GIF)
  - Add thumbnail size configuration (width, height, quality)
  - Implement aspect ratio preservation logic
  - _Requirements: 3.1, 3.4_

- [ ]\* 4.2 Write property test for thumbnail generation

  - **Property 9: Thumbnail generation fallback**
  - **Validates: Requirements 3.2**

- [ ]\* 4.3 Write property test for aspect ratio preservation

  - **Property 11: Aspect ratio preservation**
  - **Validates: Requirements 3.4**

- [x] 4.4 Implement thumbnail caching and retrieval

  - Add getThumbnail method with cache-first strategy
  - Implement cacheThumbnail method using file system or S3
  - Add thumbnail metadata storage for quick lookups
  - Implement cache invalidation for updated source files
  - _Requirements: 3.1, 4.1_

- [ ]\* 4.5 Write property test for thumbnail caching

  - **Property 13: Caching effectiveness**
  - **Validates: Requirements 4.1**

- [x] 4.6 Implement thumbnail fallback strategies

  - Add fallback to original file when thumbnail generation fails
  - Implement error recovery for unsupported formats
  - Add placeholder image for completely failed cases
  - Ensure appropriate Content-Type headers for all responses
  - _Requirements: 3.2, 3.3, 3.5_

- [ ]\* 4.7 Write property test for fallback strategies

  - **Property 10: Original file fallback**
  - **Validates: Requirements 3.3**

- [ ]\* 4.8 Write property test for Content-Type headers

  - **Property 12: Content-Type header consistency**
  - **Validates: Requirements 3.5**

- [x] 5. Create preview controller for HTTP endpoints

  - Implement REST endpoints for serving previews and thumbnails
  - Add security validation and permission checking
  - Implement efficient streaming for both S3 and local files
  - _Requirements: 3.2, 3.3, 3.4, 4.2, 4.3, 7.1, 7.4_

- [x] 5.1 Create PreviewController

  - Create PreviewController class with servePreview and serveThumbnail methods
  - Add GET /api/preview/:mediaKey endpoint for full previews
  - Add GET /api/thumbnail/:mediaKey endpoint for thumbnails
  - Implement mediaKey parsing and validation
  - Add company ID extraction from authentication context
  - _Requirements: 3.2, 3.3_

- [ ]\* 5.2 Write property test for endpoint routing

  - **Property 18: Automatic storage detection**
  - **Validates: Requirements 5.1**

- [x] 5.3 Implement security validation in controller

  - Add validatePermissions method checking user access to media
  - Implement path sanitization to prevent directory traversal
  - Add security headers (X-Content-Type-Options, X-Frame-Options)
  - Implement rate limiting for preview requests
  - _Requirements: 7.1, 7.3, 7.4_

- [ ]\* 5.4 Write property test for security validation

  - **Property 30: Path sanitization**
  - **Validates: Requirements 7.3**

- [ ]\* 5.5 Write property test for security headers

  - **Property 31: Security header inclusion**
  - **Validates: Requirements 7.4**

- [x] 5.6 Implement efficient file streaming

  - Add streaming support for S3 files using StorageDriver
  - Implement efficient local file streaming with proper headers
  - Add compression support for appropriate file types
  - Implement concurrent request handling without degradation
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ]\* 5.7 Write property test for S3 streaming

  - **Property 14: S3 streaming efficiency**
  - **Validates: Requirements 4.2**

- [ ]\* 5.8 Write property test for local streaming

  - **Property 15: Local streaming efficiency**
  - **Validates: Requirements 4.3**

- [ ]\* 5.9 Write property test for concurrent access

  - **Property 17: Concurrent access handling**
  - **Validates: Requirements 4.5**

- [x] 5.10 Add comprehensive error handling to controller

  - Implement handlePreviewError method with standardized responses
  - Add detailed error logging for debugging
  - Implement circuit breaker pattern for external storage
  - Add health metrics collection and reporting
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]\* 5.11 Write property test for error handling

  - **Property 26: Standardized error responses**
  - **Validates: Requirements 6.4**

- [ ]\* 5.12 Write property test for circuit breaker

  - **Property 25: Circuit breaker functionality**
  - **Validates: Requirements 6.3**

- [ ] 6. Update existing MediaController to use preview system

  - Refactor existing media serving logic to use new preview system
  - Maintain backward compatibility with existing URLs
  - Add THUMBNAIL_FIX resolution
  - _Requirements: 8.1, 8.3, 8.4_

- [x] 6.1 Refactor MediaController.serve method

  - Update serve method to use StorageDetectionService
  - Replace direct filesystem/S3 access with PreviewURLGeneratorService
  - Maintain existing /public/media/\* URL pattern for compatibility
  - Add logging to track usage of new vs old code paths
  - _Requirements: 8.1, 8.3_

- [ ]\* 6.2 Write property test for backward compatibility

  - **Property 33: Backward compatibility preservation**
  - **Validates: Requirements 8.1**

- [x] 6.3 Integrate thumbnail handling into MediaController

  - Add thumbnail serving capability to existing endpoints
  - Implement automatic thumbnail generation for images
  - Add thumbnail URL generation for API responses
  - Ensure THUMBNAIL_FIX issues are resolved
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]\* 6.4 Write property test for thumbnail integration

  - **Property 9: Thumbnail generation fallback**
  - **Validates: Requirements 3.2**

- [ ] 6.5 Add legacy file support

  - Implement graceful handling of files without preview metadata
  - Add migration support for existing media files
  - Ensure legacy media keys work with new system
  - Add backward compatibility for old thumbnail formats
  - _Requirements: 8.2, 8.4, 8.5_

- [ ]\* 6.6 Write property test for legacy support

  - **Property 36: Legacy file handling**
  - **Validates: Requirements 8.4**

- [x] 7. Create unified frontend preview component

  - Build React component that abstracts storage complexity
  - Add loading states and error handling
  - Implement accessibility features
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.1 Create MediaPreviewComponent

  - Create React component in frontend/src/components/MediaPreview/
  - Add props for fileId, companyId, size, fallbackComponent
  - Implement automatic storage detection through API calls
  - Add support for thumbnail, medium, and full preview sizes
  - _Requirements: 5.1, 5.4_

- [ ]\* 7.2 Write property test for component props

  - **Property 21: Size support completeness**
  - **Validates: Requirements 5.4**

- [x] 7.3 Implement loading states and error handling

  - Add loading spinner during preview retrieval
  - Implement error placeholder for failed loads
  - Add retry mechanism for transient failures
  - Provide onLoadStart, onLoadComplete, onError callbacks
  - _Requirements: 5.2, 5.3_

- [ ]\* 7.4 Write property test for loading states

  - **Property 19: Loading state consistency**
  - **Validates: Requirements 5.2**

- [ ]\* 7.5 Write property test for error placeholders

  - **Property 20: Error placeholder display**
  - **Validates: Requirements 5.3**

- [x] 7.6 Add accessibility features

  - Implement proper alt text for images
  - Add ARIA labels for screen readers
  - Ensure keyboard navigation support
  - Add focus management for modal previews
  - _Requirements: 5.5_

- [ ]\* 7.7 Write property test for accessibility

  - **Property 22: Accessibility compliance**
  - **Validates: Requirements 5.5**

- [x] 7.8 Create preview component variants

  - Create ThumbnailPreview component for small previews
  - Create FullPreview component for modal displays
  - Create MediaGallery component for multiple previews
  - Add responsive design for different screen sizes
  - _Requirements: 5.4_

- [ ] 8. Update existing frontend components to use new preview system

  - Refactor MessagesList component to use MediaPreviewComponent
  - Update ModalImageCors to use new preview URLs
  - Fix thumbnail display issues across the application
  - _Requirements: 8.1, 8.3, 8.4_

- [ ] 8.1 Refactor MessagesList component

  - Replace direct mediaUrl usage with MediaPreviewComponent
  - Update thumbnail rendering to use new thumbnail system
  - Maintain existing styling and layout
  - Add proper error handling for deleted media
  - _Requirements: 8.1, 8.3_

- [ ]\* 8.2 Write property test for component integration

  - **Property 33: Backward compatibility preservation**
  - **Validates: Requirements 8.1**

- [ ] 8.3 Update ModalImageCors component

  - Integrate with new preview URL generation
  - Add support for different preview sizes
  - Implement proper error handling for missing files
  - Maintain existing modal functionality
  - _Requirements: 8.1, 8.4_

- [x] 8.4 Fix thumbnail display across application

  - Update all components that display thumbnails
  - Ensure consistent thumbnail sizing and quality
  - Fix THUMBNAIL_FIX issues in chat messages
  - Add proper loading states for thumbnail generation
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]\* 8.5 Write property test for thumbnail fixes

  - **Property 9: Thumbnail generation fallback**
  - **Validates: Requirements 3.2**

- [ ] 9. Add audit logging and monitoring

  - Implement comprehensive logging for preview access
  - Add health metrics and monitoring
  - Create audit trail for security compliance
  - _Requirements: 6.5, 7.5_

- [ ] 9.1 Implement audit logging service

  - Create AuditLogService for preview access logging
  - Log all preview and thumbnail requests with user context
  - Add structured logging with correlation IDs
  - Implement log rotation and retention policies
  - _Requirements: 7.5_

- [ ]\* 9.2 Write property test for audit logging

  - **Property 32: Access audit logging**
  - **Validates: Requirements 7.5**

- [ ] 9.3 Add health metrics and monitoring

  - Implement metrics collection for preview system performance
  - Add monitoring for cache hit rates and response times
  - Create health check endpoints for preview services
  - Add alerting for system failures and degradation
  - _Requirements: 6.5_

- [ ]\* 9.4 Write property test for health metrics

  - **Property 27: Health metrics collection**
  - **Validates: Requirements 6.5**

- [ ] 10. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create migration utility for existing media

  - Build utility to migrate existing media to new preview system
  - Generate thumbnails for existing images
  - Update database records with preview metadata
  - _Requirements: 8.5_

- [ ] 11.1 Create MediaPreviewMigrationService

  - Create service to migrate existing media files
  - Scan all existing Message records with mediaUrl
  - Generate thumbnails for images that don't have them
  - Update database with preview metadata
  - Add progress reporting and error handling
  - _Requirements: 8.5_

- [ ]\* 11.2 Write property test for migration completeness

  - **Property 37: Migration support**
  - **Validates: Requirements 8.5**

- [ ] 11.3 Create migration CLI command

  - Add CLI command to run media preview migration
  - Support batch processing to avoid memory issues
  - Add dry-run mode for testing migration
  - Implement resume capability for interrupted migrations
  - _Requirements: 8.5_

- [ ] 12. Add configuration and environment setup

  - Add configuration options for preview system
  - Update environment variables documentation
  - Add deployment configuration
  - _Requirements: All_

- [ ] 12.1 Add preview system configuration

  - Add preview system settings to company settings
  - Configure thumbnail generation parameters (size, quality)
  - Add cache configuration options
  - Implement preview system enable/disable toggle
  - _Requirements: All_

- [ ] 12.2 Update environment documentation

  - Document new environment variables for preview system
  - Add configuration examples for different deployment scenarios
  - Create troubleshooting guide for common issues
  - Document performance tuning recommendations
  - _Requirements: All_

- [ ] 13. Final checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task should be completed and tested before moving to the next
- Property-based tests should run a minimum of 100 iterations
- All preview operations should include proper error handling and logging
- Security is critical - validate all inputs and sanitize file paths
- Maintain backward compatibility throughout implementation
- Test with multiple companies to ensure proper multi-tenant isolation
- Focus on resolving THUMBNAIL_FIX issues early in the implementation
- Integration with existing s3-media-storage module should reuse configuration
