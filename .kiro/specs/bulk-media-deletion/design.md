# Bulk Media Deletion Design Document

## Overview

This design document outlines the implementation of an asynchronous bulk media deletion system that enhances the existing Media Management module. The solution provides a robust, user-friendly interface for selecting and deleting multiple media files while maintaining system responsiveness and data consistency across page reloads and navigation changes.

### Integration with Existing Specs

This bulk media deletion feature builds upon and integrates with two existing specifications:

#### s3-media-storage Integration (#[[file:.kiro/specs/s3-media-storage/design.md]])

- **Storage Driver Compatibility**: The bulk deletion system uses the same StorageDriverFactory and IStorageDriver interface established in s3-media-storage
- **Hybrid Storage Support**: Deletion works seamlessly with both local filesystem and S3-compatible storage backends
- **Media Key Format**: Maintains the same media key format (media/{companyId}/{contactId}/{ticketId}/{randomId}/{filename}) for consistent file identification
- **Configuration Reuse**: Leverages the existing GetStorageConfigService to determine storage backend per company
- **Error Handling**: Extends the existing storage error handling patterns for consistent user experience

#### file-preview Integration (#[[file:.kiro/specs/file-preview/design.md]])

- **Preview Integration**: The media management interface can optionally integrate FilePreview components for file thumbnails
- **URL Compatibility**: Works with the same media URL format (BACKEND_URL/public/<key>) used by the preview system
- **File Type Detection**: Can leverage the same file type detection utilities for enhanced UI display
- **Modal Consistency**: Deletion confirmation dialogs follow similar modal patterns as file preview modals

The design builds upon the existing media management architecture, extending it with asynchronous processing capabilities, real-time status tracking, and enhanced user experience features while maintaining full compatibility with the established storage and preview systems.

## Architecture

The bulk media deletion system follows a layered architecture that integrates with the existing Media Management module:

### Frontend Architecture

- **Presentation Layer**: Enhanced MediaManagement component with selection controls and status indicators
- **State Management**: Extended useMediaManagement hook with bulk deletion state management
- **Communication Layer**: API service extensions for bulk operations and status polling

### Backend Architecture

- **Controller Layer**: Enhanced MediaManagementController with async bulk deletion endpoints
- **Service Layer**: New BulkDeletionProcessService for managing asynchronous operations
- **Domain Layer**: BulkDeletionProcess entity for tracking operation state
- **Infrastructure Layer**: Queue system integration for background processing

### Communication Flow

```
Frontend Selection → API Request → Background Process → Status Polling → UI Updates
```

## Components and Interfaces

### Frontend Components

#### Enhanced MediaManagement Component

- Integrates bulk selection controls
- Manages deletion process status display
- Handles process state persistence across navigation

#### BulkDeletionStatusIndicator Component

- Displays current deletion progress
- Shows completion percentage and remaining files
- Provides error details when failures occur

#### Enhanced MediaTable Component

- Adds selection checkboxes for individual files
- Implements "Select All" functionality
- Filters selectable files based on deletion permissions

### Backend Services

#### BulkDeletionProcessService

```typescript
interface BulkDeletionProcessService {
  initiateBulkDeletion(
    request: BulkDeletionRequest
  ): Promise<BulkDeletionResponse>;
  getProcessStatus(processId: string): Promise<ProcessStatus>;
  cancelProcess(processId: string): Promise<void>;
}
```

#### AsyncDeletionWorkerService

```typescript
interface AsyncDeletionWorkerService {
  processDeleteQueue(processId: string): Promise<void>;
  updateProgress(processId: string, progress: ProcessProgress): Promise<void>;
  handleDeletionFailure(processId: string, error: DeletionError): Promise<void>;
}
```

### API Endpoints

#### POST /media/bulk-delete-async

- Initiates asynchronous bulk deletion
- Returns process ID immediately
- Queues deletion job for background processing

#### GET /media/bulk-delete-status/:processId

- Returns current status of deletion process
- Provides progress information and error details
- Supports real-time polling

#### DELETE /media/bulk-delete-cancel/:processId

- Cancels ongoing deletion process
- Stops further file processing
- Updates process status to cancelled

## Data Models

### BulkDeletionProcess Entity

```typescript
interface BulkDeletionProcess {
  id: string;
  companyId: number;
  userId: number;
  status: ProcessStatus;
  totalFiles: number;
  processedFiles: number;
  successfulDeletions: number;
  failedDeletions: number;
  errorDetails: DeletionError[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
```

### ProcessStatus Enumeration

```typescript
enum ProcessStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}
```

### DeletionError Interface

```typescript
interface DeletionError {
  messageId: string;
  fileName: string;
  errorMessage: string;
  errorCode: string;
  timestamp: Date;
}
```

### BulkDeletionRequest Interface

```typescript
interface BulkDeletionRequest {
  messageIds: string[];
  companyId: number;
  userId: number;
}
```

### BulkDeletionResponse Interface

```typescript
interface BulkDeletionResponse {
  processId: string;
  status: ProcessStatus;
  totalFiles: number;
  estimatedDuration: number;
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Reflection

After reviewing all properties identified in the prework, several can be consolidated to eliminate redundancy:

- Properties 1.4 and 1.5 can be combined into a single property about button state based on selection
- Properties 4.1, 4.3, and 4.5 can be consolidated into a comprehensive concurrency control property
- Properties 5.1, 5.2, and 5.4 can be combined into a state persistence property
- Properties 7.1, 7.2, 7.3, and 7.5 can be consolidated into a comprehensive idempotency property

### Correctness Properties

Property 1: Selection count accuracy
_For any_ set of selected media files, the displayed count should exactly match the number of files in the selection
**Validates: Requirements 1.3**

Property 2: Select all completeness
_For any_ set of visible media files, clicking "Select All" should select exactly all currently visible files that can be deleted
**Validates: Requirements 1.2**

Property 3: Button state consistency
_For any_ selection state, the bulk deletion button should be enabled if and only if at least one file is selected
**Validates: Requirements 1.4, 1.5**

Property 4: Immediate response with process ID
_For any_ valid bulk deletion request, the system should respond within 2 seconds with a unique process identifier
**Validates: Requirements 2.1, 2.3**

Property 5: Process creation consistency
_For any_ initiated bulk deletion, a BulkDeletionProcess should be created with status "in_progress"
**Validates: Requirements 2.2, 2.4**

Property 6: Status endpoint availability
_For any_ active deletion process, querying the status endpoint should return current process state and completion percentage
**Validates: Requirements 3.1, 3.2**

Property 7: State transition correctness
_For any_ deletion process, successful completion should result in status "completed" and failures should result in status "failed" with error details
**Validates: Requirements 3.3, 3.4**

Property 8: Concurrency control
_For any_ system state, at most one bulk deletion process should be active, and attempts to start concurrent processes should be rejected
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

Property 9: State persistence across navigation
_For any_ active deletion process, page reloads and navigation should restore the correct UI state reflecting the ongoing operation
**Validates: Requirements 5.1, 5.2, 5.4**

Property 10: Error resilience
_For any_ bulk deletion process with partial failures, the system should continue processing remaining files and report accurate success/failure counts
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

Property 11: Idempotency guarantee
_For any_ deletion request containing duplicate or already-deleted files, the system should process each file at most once and handle missing files gracefully
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

## Error Handling

### Frontend Error Handling

- **Network Failures**: Implement retry logic with exponential backoff for status polling
- **Process Failures**: Display detailed error messages with options to retry or cancel
- **Validation Errors**: Prevent invalid selections and provide clear feedback

### Backend Error Handling

- **File Access Errors**: Log detailed error information and continue processing remaining files
- **Storage Errors**: Implement retry logic for transient storage failures
- **Process Corruption**: Detect and recover from corrupted process states

### Error Recovery Strategies

- **Partial Failures**: Allow users to retry failed deletions separately
- **Process Timeout**: Implement automatic cleanup for stalled processes
- **Concurrent Access**: Handle race conditions gracefully with proper locking

## Testing Strategy

### Unit Testing Approach

The system will use Jest for unit testing, focusing on:

- Individual component behavior verification
- Service method correctness validation
- Error handling path coverage
- State management logic verification

Unit tests will cover specific examples and edge cases:

- Empty selection states
- Single file selections
- Maximum selection limits
- Network error scenarios
- Invalid process IDs

### Property-Based Testing Approach

The system will use fast-check for property-based testing with a minimum of 100 iterations per property. Each property-based test will be tagged with comments referencing the design document properties.

Property-based tests will verify universal behaviors across all valid inputs:

- Selection state consistency across random file sets
- Process state transitions for any valid deletion request
- Concurrency control under various system states
- Error handling resilience with random failure scenarios
- Idempotency guarantees with duplicate and missing files

### Integration Testing

- End-to-end deletion workflows
- Real-time status update mechanisms
- Cross-browser compatibility for UI components
- Database transaction integrity during bulk operations

### Performance Testing

- Response time validation for bulk deletion initiation
- Status polling efficiency under load
- Memory usage during large file set processing
- Concurrent user scenario handling

**Integration with s3-media-storage**: This service leverages the existing StorageDriverFactory and IStorageDriver interface to delete files from both local and S3 storage backends seamlessly. It uses the same GetStorageConfigService to determine the appropriate storage driver for each company and maintains compatibility with the hybrid storage mode where files can exist in both local and S3 storage.

**Integration with file-preview**: The media management interface can optionally use FilePreview components to display thumbnails of files before deletion, providing users with visual confirmation of what they're about to delete. The deletion confirmation dialogs follow similar modal patterns as the file preview modals for UI consistency.

## Implementation Integration Points

### With s3-media-storage Spec

The bulk deletion system integrates with s3-media-storage at these key points:

1. **Storage Driver Usage**: Uses the same StorageDriverFactory.createDriver() method to get the appropriate storage driver (local or S3) for each company
2. **Configuration Service**: Leverages GetStorageConfigService to retrieve storage configuration per company
3. **Media Key Format**: Maintains the same media key format for consistent file identification across storage backends
4. **Error Handling**: Extends the existing storage error handling patterns (S3AuthenticationError, S3BucketNotFoundError, etc.)
5. **Hybrid Mode Support**: Works seamlessly with the hybrid mode where old files remain local and new files go to S3

### With file-preview Spec

The bulk deletion system can optionally integrate with file-preview at these points:

1. **Thumbnail Display**: Can use FileThumbnail components in the media management interface to show file previews
2. **File Type Detection**: Can leverage the same detectFileType utility for enhanced UI display
3. **Modal Patterns**: Deletion confirmation dialogs follow similar modal patterns as FilePreviewModal for consistency
4. **URL Compatibility**: Works with the same media URL format (BACKEND_URL/public/<key>) used by the preview system

### Database Schema Extensions

The bulk deletion system extends the existing database schema with a new table:

```sql
CREATE TABLE bulk_deletion_processes (
  id VARCHAR(36) PRIMARY KEY,
  company_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled') NOT NULL,
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  successful_deletions INTEGER DEFAULT 0,
  failed_deletions INTEGER DEFAULT 0,
  error_details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_company_status (company_id, status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Queue System Integration

The system integrates with a background job queue (such as Bull or similar) for processing deletions asynchronously:

```typescript
// Queue job definition
interface BulkDeletionJob {
  processId: string;
  messageIds: string[];
  companyId: number;
  userId: number;
}

// Queue processor
async function processBulkDeletion(job: Job<BulkDeletionJob>) {
  const { processId, messageIds, companyId, userId } = job.data;

  // Get storage configuration using s3-media-storage service
  const config = await GetStorageConfigService(companyId);
  const driver = await StorageDriverFactory.createDriver(config);

  // Process each file deletion
  for (const messageId of messageIds) {
    try {
      await deleteMediaFile({ messageId, companyId, userId }, driver);
      await updateProgress(processId, { successfulDeletions: +1 });
    } catch (error) {
      await updateProgress(processId, {
        failedDeletions: +1,
        errorDetails: [...existingErrors, error],
      });
    }
  }

  await finalizeProcess(processId);
}
```

## Security Considerations

### Access Control

- Only admin users can perform bulk deletions
- Company isolation enforced at all levels
- Process ownership validation (users can only access their own processes)

### Rate Limiting

- Limit number of concurrent bulk deletion processes per company
- Implement request rate limiting for status polling endpoints
- Maximum file count limits per bulk deletion request

### Audit Logging

- Log all bulk deletion initiations with user and file details
- Track process state changes and completion status
- Maintain audit trail for compliance and debugging

## Performance Considerations

### Background Processing

- Use job queues to handle deletions asynchronously
- Implement proper error handling and retry logic
- Monitor queue health and processing times

### Database Optimization

- Index on company_id and status for efficient queries
- Implement cleanup for old completed processes
- Use database transactions for consistency

### Frontend Optimization

- Implement efficient polling with exponential backoff
- Cache process status to reduce API calls
- Use WebSocket connections for real-time updates when available

## Deployment Considerations

### Environment Variables

```bash
# Queue configuration
REDIS_URL=redis://localhost:6379
BULK_DELETION_QUEUE_NAME=bulk-media-deletion

# Process limits
MAX_CONCURRENT_DELETIONS_PER_COMPANY=1
MAX_FILES_PER_BULK_DELETION=1000
BULK_DELETION_TIMEOUT_MINUTES=60
```

### Monitoring and Alerting

- Monitor queue processing times and failure rates
- Alert on stuck or failed bulk deletion processes
- Track storage operation success rates
- Monitor database performance for bulk operations

## Migration Strategy

### Phase 1: Core Implementation

1. Implement BulkDeletionProcess entity and database table
2. Create BulkDeletionProcessService with basic functionality
3. Add async bulk deletion API endpoints
4. Implement background job processing

### Phase 2: Frontend Integration

1. Enhance MediaManagement component with selection controls
2. Add status polling and progress display
3. Implement state persistence across navigation
4. Add error handling and user feedback

### Phase 3: Advanced Features

1. Add process cancellation functionality
2. Implement retry mechanisms for failed deletions
3. Add comprehensive logging and monitoring
4. Optimize performance and add caching

### Phase 4: Integration and Polish

1. Integrate with file-preview for enhanced UI
2. Add comprehensive testing coverage
3. Performance optimization and monitoring
4. Documentation and deployment guides

## Summary

This design provides a comprehensive solution for bulk media deletion that seamlessly integrates with the existing s3-media-storage and file-preview specifications. The asynchronous architecture ensures system responsiveness while the robust error handling and state management provide a reliable user experience. The design maintains full compatibility with both local and S3 storage backends while providing the flexibility to handle large-scale deletion operations efficiently.
