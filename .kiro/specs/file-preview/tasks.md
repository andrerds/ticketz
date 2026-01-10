# Implementation Plan: File Preview System

## Overview

This implementation plan breaks down the file preview feature into incremental, testable tasks. Each task builds on previous work and includes specific requirements references. The plan follows a phased approach to deliver value incrementally while maintaining system stability and ensuring seamless integration with the s3-media-storage spec.

## Task List

- [ ] 1. Set up core preview infrastructure

  - Install react-pdf and configure PDF.js worker
  - Create base component structure and types
  - Set up error handling foundation
  - _Requirements: 1.1, 4.1, 14.1_

- [ ] 1.1 Install dependencies and configure PDF.js

  - Install react-pdf, pdfjs-dist packages
  - Configure PDF.js worker URL to use CDN
  - Add react-pdf CSS imports for annotations and text layer
  - Update package.json with correct versions
  - _Requirements: 1.1_

- [ ] 1.2 Create base types and interfaces

  - Create FilePreview/types.ts with FileType, FileMetadata, PreviewState, PreviewError types
  - Define FilePreviewProps interface
  - Define component prop interfaces for all preview components
  - _Requirements: 4.1, 4.3_

- [ ] 1.3 Create error classes

  - Implement PreviewError base class
  - Implement NetworkError, CORSError, FormatError, MemoryError classes
  - Add error type discrimination logic
  - _Requirements: 14.1, 14.2, 14.3_

- [ ]\* 1.4 Write property test for error class creation

  - **Property 59: React-pdf error catching**
  - **Property 60: CORS error messages**
  - **Property 61: Corrupted file handling**
  - **Validates: Requirements 14.1, 14.2, 14.3**

- [ ] 2. Implement file type detection

  - Create utility for detecting file types from URLs and filenames
  - Support PDF, image, and text file extensions
  - Handle edge cases and unknown types
  - _Requirements: 4.2_

- [ ] 2.1 Create file type detection utility

  - Implement detectFileType() function
  - Support extensions: pdf, jpg, jpeg, png, gif, webp, svg, bmp, txt, log, md, csv, json, xml
  - Return 'pdf' | 'image' | 'text' | 'unsupported'
  - Implement getMimeType() helper function
  - _Requirements: 4.2_

- [ ]\* 2.2 Write property test for file type detection

  - **Property 17: Automatic file type detection**
  - **Validates: Requirements 4.2**

- [ ] 3. Implement PDF preview component

  - Create PDFPreview component using react-pdf
  - Implement page navigation for multi-page PDFs
  - Add loading and error states
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3.1 Create PDFPreview component

  - Implement component with Document and Page from react-pdf
  - Add state for numPages, currentPage, loading, error
  - Implement handleLoadSuccess and handleLoadError
  - Add scale prop support
  - Render loading spinner during load
  - Render error display on failure
  - _Requirements: 1.1, 1.4, 1.5_

- [ ]\* 3.2 Write property test for PDF rendering

  - **Property 1: PDF rendering with react-pdf**
  - **Property 4: PDF loading indicator**
  - **Property 5: PDF error handling**
  - **Validates: Requirements 1.1, 1.4, 1.5**

- [ ] 3.3 Add page navigation controls

  - Create PageNavigation component
  - Implement goToNextPage and goToPreviousPage functions
  - Show controls only when numPages > 1
  - Display current page and total pages
  - Add next/previous buttons
  - _Requirements: 1.2, 1.3_

- [ ]\* 3.4 Write property test for page navigation

  - **Property 2: Multi-page PDF navigation controls**
  - **Property 3: Page navigation updates display**
  - **Validates: Requirements 1.2, 1.3**

- [ ] 4. Implement image preview component

  - Create ImagePreview component with native img element
  - Add loading placeholder and error handling
  - Implement zoom support
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4.1 Create ImagePreview component

  - Implement component with img element
  - Add state for loading and error
  - Implement onLoad and onError handlers
  - Apply scale transform via style
  - Set objectFit: contain and maxWidth/maxHeight: 100%
  - Render loading placeholder during load
  - Render broken image placeholder on error
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]\* 4.2 Write property test for image preview

  - **Property 6: Image rendering**
  - **Property 7: Image loading placeholder**
  - **Property 8: Image error placeholder**
  - **Property 9: Image aspect ratio preservation**
  - **Property 10: Image zoom scaling**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [ ] 5. Implement text preview component

  - Create TextPreview component with fetch and display
  - Add loading and error states
  - Preserve formatting and enable scrolling
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.1 Create TextPreview component

  - Implement component with useEffect for fetching
  - Add state for content, loading, error
  - Fetch text content from URL
  - Handle fetch errors with try-catch
  - Render content in pre element with whiteSpace: pre-wrap
  - Add overflow: auto for scrolling
  - Render loading spinner during fetch
  - Render error display on failure
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]\* 5.2 Write property test for text preview

  - **Property 11: Text content fetching and display**
  - **Property 12: Text loading indicator**
  - **Property 13: Text error handling**
  - **Property 14: Text formatting preservation**
  - **Property 15: Text scrolling**
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [ ] 6. Create zoom controls component

  - Implement ZoomControls with zoom in/out/reset buttons
  - Handle zoom state management
  - Add keyboard shortcut support
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 6.1 Create ZoomControls component

  - Create component with zoom in, zoom out, reset buttons
  - Accept scale, onZoomIn, onZoomOut, onReset props
  - Display current zoom percentage
  - Add icons for buttons
  - Style buttons appropriately
  - _Requirements: 6.1_

- [ ]\* 6.2 Write property test for zoom controls

  - **Property 25: Zoom controls rendering**
  - **Property 26: Zoom in increases scale**
  - **Property 27: Zoom out decreases scale**
  - **Property 28: Zoom reset restores default**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 7. Implement keyboard navigation hook

  - Create useKeyboardNavigation hook
  - Support arrow keys, zoom keys, ESC key
  - Prevent default browser behavior
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 7.1 Create useKeyboardNavigation hook

  - Accept onNext, onPrevious, onZoomIn, onZoomOut, onClose, enabled options
  - Add keydown event listener
  - Handle ArrowRight/ArrowDown for next
  - Handle ArrowLeft/ArrowUp for previous
  - Handle +/= for zoom in
  - Handle -/\_ for zoom out
  - Handle Escape for close
  - Call preventDefault on all handled keys
  - Cleanup event listener on unmount
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ]\* 7.2 Write property test for keyboard navigation

  - **Property 47: Arrow key page navigation**
  - **Property 23: ESC key modal close**
  - **Property 48: Keyboard zoom controls**
  - **Property 49: Keyboard event prevention**
  - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

- [ ] 8. Implement preview cache hook

  - Create caching mechanism for preview content
  - Implement cache with TTL
  - Add cache invalidation logic
  - _Requirements: 12.5_

- [ ] 8.1 Create PreviewCache class and hook

  - Implement PreviewCache class with Map storage
  - Add set() and get() methods with timestamp checking
  - Set default maxAge to 5 minutes
  - Implement clear() method
  - Create usePreviewCache hook
  - Check cache before fetching
  - Store fetched data in cache
  - _Requirements: 12.5_

- [ ]\* 8.2 Write property test for caching

  - **Property 53: Preview content caching**
  - **Validates: Requirements 12.5**

- [ ] 9. Create file preview modal component

  - Implement full-screen modal with preview content
  - Add header with metadata and controls
  - Handle open/close with keyboard and click-outside
  - Prevent background scrolling
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 9.1 Create ModalHeader component

  - Display filename, file size, file type, upload date
  - Add close button
  - Add download button (conditional)
  - Style header appropriately
  - _Requirements: 5.2, 13.1, 13.2, 13.4, 13.5_

- [ ]\* 9.2 Write property test for metadata display

  - **Property 54: Filename display**
  - **Property 55: File size display**
  - **Property 57: File type display**
  - **Property 58: Upload date display**
  - **Validates: Requirements 13.1, 13.2, 13.4, 13.5**

- [ ] 9.3 Create FilePreviewModal component

  - Implement modal with backdrop and content container
  - Add state for scale and isOpen
  - Set body overflow to hidden on mount
  - Restore body overflow on unmount
  - Add ESC key listener for close
  - Handle backdrop click for close
  - Stop propagation on content click
  - Render ModalHeader with metadata
  - Render appropriate preview component based on fileType
  - Render ZoomControls (conditional)
  - Render UnsupportedFileMessage for unsupported types
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]\* 9.4 Write property test for modal behavior

  - **Property 20: Modal full-screen display**
  - **Property 21: Modal controls presence**
  - **Property 22: Click-outside modal close**
  - **Property 23: ESC key modal close**
  - **Property 24: Background scroll prevention**
  - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 9.5 Implement download functionality

  - Add handleDownload function to modal
  - Fetch file as blob
  - Create blob URL and download link
  - Trigger download with original filename
  - Revoke blob URL after download
  - Handle download errors
  - _Requirements: 7.1, 7.2, 7.3_

- [ ]\* 9.6 Write property test for download

  - **Property 29: Download triggers file download**
  - **Property 30: Download filename preservation**
  - **Property 31: Download error handling**
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [ ] 10. Create file thumbnail component

  - Implement thumbnail with lazy loading
  - Support PDF, image, and text file thumbnails
  - Add click handler to open modal
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 12.2_

- [ ] 10.1 Create FileThumbnail component

  - Implement component with ref for intersection observer
  - Add state for isInView
  - Set up IntersectionObserver in useEffect
  - Render ThumbnailPlaceholder when not in view
  - Render appropriate thumbnail based on fileType when in view
  - Apply maxSize to container style
  - Add onClick handler
  - Cleanup observer on unmount
  - _Requirements: 9.4, 9.5, 12.2_

- [ ]\* 10.2 Write property test for lazy loading

  - **Property 52: Lazy loading thumbnails**
  - **Property 42: Thumbnail size constraints**
  - **Property 41: Thumbnail click opens modal**
  - **Validates: Requirements 9.4, 9.5, 12.2**

- [ ] 10.3 Create PDFThumbnail component

  - Use react-pdf Document and Page
  - Render only first page (pageNumber=1)
  - Use small scale for thumbnail
  - Handle loading and error states
  - _Requirements: 9.1, 12.1_

- [ ]\* 10.4 Write property test for PDF thumbnail

  - **Property 38: PDF thumbnail rendering**
  - **Property 51: Single page rendering for PDFs**
  - **Validates: Requirements 9.1, 12.1**

- [ ] 10.5 Create ImageThumbnail component

  - Render img element with thumbnail size
  - Handle loading and error states
  - Apply object-fit: cover for thumbnails
  - _Requirements: 9.2_

- [ ]\* 10.6 Write property test for image thumbnail

  - **Property 39: Image thumbnail rendering**
  - **Validates: Requirements 9.2**

- [ ] 10.7 Create FileIcon component

  - Render appropriate icon based on file type
  - Support text, unknown, and other file types
  - Use Material-UI icons or custom SVG
  - _Requirements: 9.3_

- [ ]\* 10.8 Write property test for file icon

  - **Property 40: Text file icon rendering**
  - **Validates: Requirements 9.3**

- [ ] 11. Create main FilePreview component

  - Implement main entry point component
  - Support thumbnail, inline, and modal modes
  - Integrate all sub-components
  - _Requirements: 4.1, 4.3_

- [ ] 11.1 Create FilePreview component

  - Accept all FilePreviewProps
  - Call detectFileType to determine file type
  - Render FileThumbnail when mode is 'thumbnail'
  - Render FilePreviewModal when mode is 'modal'
  - Render FilePreviewInline when mode is 'inline'
  - Pass appropriate props to sub-components
  - _Requirements: 4.1, 4.3_

- [ ]\* 11.2 Write property test for main component

  - **Property 16: Single component for all file types**
  - **Property 18: Configuration props acceptance**
  - **Validates: Requirements 4.1, 4.3**

- [ ] 11.3 Create FilePreviewInline component

  - Render preview content without modal wrapper
  - Support zoom controls (conditional)
  - Render appropriate preview based on fileType
  - _Requirements: 4.1_

- [ ] 12. Implement error boundary and error display

  - Create PreviewErrorBoundary component
  - Create ErrorDisplay component
  - Add retry functionality
  - _Requirements: 8.1, 8.2, 8.3, 14.1_

- [ ] 12.1 Create ErrorDisplay component

  - Display error message based on error type
  - Show retry button
  - Show download button for unsupported/corrupted files
  - Style error display appropriately
  - _Requirements: 8.2, 8.3, 8.4_

- [ ]\* 12.2 Write property test for error display

  - **Property 34: Error message display**
  - **Property 35: Retry action provision**
  - **Property 36: Unsupported file handling**
  - **Property 37: Network error messages**
  - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [ ] 12.3 Create PreviewErrorBoundary component

  - Extend React.Component with error boundary methods
  - Implement getDerivedStateFromError
  - Implement componentDidCatch
  - Render ErrorDisplay on error
  - Call onError callback
  - Log errors to console
  - _Requirements: 14.1, 14.5_

- [ ]\* 12.4 Write property test for error boundary

  - **Property 59: React-pdf error catching**
  - **Property 62: Error logging**
  - **Validates: Requirements 14.1, 14.5**

- [ ] 13. Add loading states and placeholders

  - Create LoadingSpinner component
  - Create LoadingPlaceholder component
  - Create ThumbnailPlaceholder component
  - _Requirements: 8.1_

- [ ] 13.1 Create loading components

  - Implement LoadingSpinner with spinner animation
  - Implement LoadingPlaceholder with skeleton UI
  - Implement ThumbnailPlaceholder with gray box
  - Implement BrokenImagePlaceholder with icon
  - Style all placeholders appropriately
  - _Requirements: 8.1_

- [ ]\* 13.2 Write property test for loading states

  - **Property 33: Loading state display**
  - **Validates: Requirements 8.1**

- [ ] 14. Integrate with s3-media-storage URLs

  - Ensure component works with both local and S3 URLs
  - Test with BACKEND_URL/public/<key> format
  - Test with absolute S3 URLs
  - _Requirements: 4.4, 7.4, 10.1, 10.2, 10.3, 10.4_

- [ ] 14.1 Test URL handling

  - Test component with local URLs (relative paths)
  - Test component with S3 URLs (absolute https URLs)
  - Test component with BACKEND_URL/public/<key> format
  - Verify download works with both URL types
  - Verify preview works with both URL types
  - _Requirements: 4.4, 7.4, 10.1, 10.2, 10.3, 10.4_

- [ ]\* 14.2 Write property test for storage compatibility

  - **Property 19: Storage backend compatibility**
  - **Property 32: Download storage compatibility**
  - **Property 43: Media URL format compliance**
  - **Property 44: S3 URL handling**
  - **Property 45: Local URL handling**
  - **Property 46: Storage backend resilience**
  - **Validates: Requirements 4.4, 7.4, 10.1, 10.2, 10.3, 10.4**

- [ ] 15. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Integrate with Message components

  - Update MessagesList to use FilePreview for thumbnails
  - Update MessageItem to use FilePreview modal
  - Replace existing media display logic
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 16.1 Update MessagesList component

  - Import FilePreview component
  - Replace existing media rendering with FilePreview in thumbnail mode
  - Add state for modal open/close
  - Add click handler to open modal
  - Render FilePreview in modal mode when modal is open
  - Pass mediaUrl, filename, fileSize, uploadDate to FilePreview
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 16.2 Update MessageItem component

  - Ensure FilePreview is used for all media types
  - Remove old media display logic
  - Test with PDF, image, and text files
  - _Requirements: 9.1, 9.2, 9.3_

- [ ] 17. Add keyboard shortcuts help

  - Create KeyboardShortcutsHelp component
  - Display shortcuts in tooltip or help dialog
  - Add help button to modal
  - _Requirements: 11.5_

- [ ] 17.1 Create KeyboardShortcutsHelp component

  - List all keyboard shortcuts (arrows, +/-, ESC)
  - Style as tooltip or small dialog
  - Add help icon button to modal header
  - Show/hide on button click
  - _Requirements: 11.5_

- [ ]\* 17.2 Write property test for shortcuts help

  - **Property 50: Keyboard shortcuts help**
  - **Validates: Requirements 11.5**

- [ ] 18. Add PDF page count display

  - Update PDFPreview to show page count
  - Display in modal header for PDFs
  - _Requirements: 13.3_

- [ ] 18.1 Display PDF page count

  - Pass numPages from PDFPreview to parent
  - Display in ModalHeader when fileType is 'pdf'
  - Format as "Page X of Y"
  - _Requirements: 13.3_

- [ ]\* 18.2 Write property test for page count

  - **Property 56: PDF page count display**
  - **Validates: Requirements 13.3**

- [ ] 19. Add styling and CSS

  - Create CSS modules for all components
  - Ensure responsive design
  - Add animations for loading and transitions
  - _Requirements: All_

- [ ] 19.1 Create component styles

  - Create FilePreview.module.css
  - Create FilePreviewModal.module.css
  - Create PDFPreview.module.css
  - Create ImagePreview.module.css
  - Create TextPreview.module.css
  - Create FileThumbnail.module.css
  - Create ZoomControls.module.css
  - Add responsive breakpoints
  - Add loading animations
  - Add transition effects
  - Ensure WCAG AA contrast ratios
  - _Requirements: All_

- [ ] 20. Add accessibility features

  - Add ARIA labels to all controls
  - Add ARIA live regions for loading/error states
  - Ensure proper focus management
  - Test with screen readers
  - _Requirements: All_

- [ ] 20.1 Implement accessibility

  - Add aria-label to all buttons
  - Add role="dialog" to modal
  - Add aria-modal="true" to modal
  - Add aria-live="polite" to loading/error states
  - Implement focus trap in modal
  - Set initial focus to close button on modal open
  - Restore focus to trigger element on modal close
  - Add alt text to images
  - Add aria-describedby for error messages
  - _Requirements: All_

- [ ] 21. Final checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Documentation and examples

  - Create component documentation
  - Add usage examples
  - Document props and APIs
  - Create Storybook stories
  - _Requirements: All_

- [ ] 22.1 Create documentation

  - Document FilePreview component API
  - Document all props and their types
  - Add usage examples for thumbnail, inline, and modal modes
  - Document keyboard shortcuts
  - Document integration with s3-media-storage
  - Add troubleshooting guide
  - Document browser compatibility
  - _Requirements: All_

- [ ] 22.2 Create Storybook stories

  - Create story for PDF preview
  - Create story for image preview
  - Create story for text preview
  - Create story for thumbnail mode
  - Create story for modal mode
  - Create story for error states
  - Create story for loading states
  - _Requirements: All_

## Notes

- Each task should be completed and tested before moving to the next
- Property-based tests should run a minimum of 100 iterations
- All components should be wrapped in PreviewErrorBoundary
- Ensure proper cleanup of event listeners and observers
- Test with various file sizes and types
- Verify integration with both local and S3 storage from s3-media-storage spec
- Maintain accessibility throughout implementation
- Follow React best practices and hooks guidelines
