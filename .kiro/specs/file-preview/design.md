# Design Document: File Preview System

## Overview

This design document outlines the technical architecture for implementing a unified file preview system for PDF, image, and text files in the Ticketz application. The solution follows Domain-Driven Design (DDD) principles, Clean Architecture patterns, and React best practices, ensuring reusability, performance, and maintainability.

The system explicitly integrates with the **s3-media-storage** spec (#[[file:.kiro/specs/s3-media-storage/design.md]]), ensuring seamless preview functionality regardless of whether files are stored locally or in S3-compatible storage. The preview component will use react-pdf for PDF rendering, native browser capabilities for images, and custom text rendering for plain text files.

### Key Design Goals

1. **Reusability**: Single component usable throughout the application
2. **Performance**: Lazy loading, caching, and progressive rendering
3. **Storage Integration**: Seamless work with s3-media-storage URLs
4. **Accessibility**: Keyboard navigation and screen reader support
5. **Error Resilience**: Graceful degradation with clear error messages
6. **User Experience**: Smooth loading states and intuitive controls

## Architecture

### Component Hierarchy

```
FilePreview (Main Component)
├── FilePreviewModal (Full-screen preview)
│   ├── ModalHeader (Close, Download, Metadata)
│   ├── ModalContent
│   │   ├── PDFPreview
│   │   ├── ImagePreview
│   │   └── TextPreview
│   └── ModalControls (Zoom, Navigation)
├── FileThumbnail (Inline preview)
│   ├── PDFThumbnail
│   ├── ImageThumbnail
│   └── FileIcon
└── PreviewError (Error boundary)
```

### Integration with s3-media-storage

```
FilePreview Component
        ↓
   Media URL (from Message model)
        ↓
   GET /public/<key> (from s3-media-storage)
        ↓
   ┌────────────────┐
   │ MediaController│
   └────────────────┘
        ↓
   ┌─────────┴─────────┐
   ↓                   ↓
Local Storage    S3 Storage
(Filesystem)     (AWS SDK)
```

## Components and Interfaces

### 1. FilePreview Component (Main Entry Point)

```typescript
// frontend/src/components/FilePreview/FilePreview.tsx
export interface FilePreviewProps {
  url: string;
  filename?: string;
  fileSize?: number;
  uploadDate?: Date;
  mode?: "thumbnail" | "inline" | "modal";
  enableZoom?: boolean;
  enableDownload?: boolean;
  onClose?: () => void;
  maxThumbnailSize?: number;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  url,
  filename,
  fileSize,
  uploadDate,
  mode = "inline",
  enableZoom = true,
  enableDownload = true,
  onClose,
  maxThumbnailSize = 200,
}) => {
  const fileType = detectFileType(url, filename);

  if (mode === "thumbnail") {
    return (
      <FileThumbnail url={url} fileType={fileType} maxSize={maxThumbnailSize} />
    );
  }

  if (mode === "modal") {
    return (
      <FilePreviewModal
        url={url}
        filename={filename}
        fileSize={fileSize}
        uploadDate={uploadDate}
        fileType={fileType}
        enableZoom={enableZoom}
        enableDownload={enableDownload}
        onClose={onClose}
      />
    );
  }

  return (
    <FilePreviewInline url={url} fileType={fileType} enableZoom={enableZoom} />
  );
};
```

### 2. File Type Detection

```typescript
// frontend/src/components/FilePreview/utils/fileTypeDetection.ts
export type FileType = "pdf" | "image" | "text" | "unsupported";

export function detectFileType(url: string, filename?: string): FileType {
  const name = filename || url;
  const extension = name.split(".").pop()?.toLowerCase();

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
  const textExtensions = ["txt", "log", "md", "csv", "json", "xml"];

  if (extension === "pdf") return "pdf";
  if (imageExtensions.includes(extension || "")) return "image";
  if (textExtensions.includes(extension || "")) return "text";

  return "unsupported";
}

export function getMimeType(fileType: FileType): string {
  switch (fileType) {
    case "pdf":
      return "application/pdf";
    case "image":
      return "image/*";
    case "text":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}
```

### 3. PDF Preview Component

```typescript
// frontend/src/components/FilePreview/PDFPreview.tsx
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export interface PDFPreviewProps {
  url: string;
  scale?: number;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: Error) => void;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  url,
  scale = 1.0,
  onLoadSuccess,
  onLoadError,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    onLoadSuccess?.(numPages);
  };

  const handleLoadError = (error: Error) => {
    setError(error);
    setLoading(false);
    onLoadError?.(error);
  };

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorDisplay error={error} onRetry={() => window.location.reload()} />
    );
  }

  return (
    <div className="pdf-preview">
      <Document
        file={url}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        loading={<LoadingSpinner />}
      >
        <Page
          pageNumber={currentPage}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
        />
      </Document>

      {numPages > 1 && (
        <PageNavigation
          currentPage={currentPage}
          totalPages={numPages}
          onNext={goToNextPage}
          onPrevious={goToPreviousPage}
        />
      )}
    </div>
  );
};
```

### 4. Image Preview Component

```typescript
// frontend/src/components/FilePreview/ImagePreview.tsx
export interface ImagePreviewProps {
  url: string;
  alt?: string;
  scale?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  url,
  alt = "Image preview",
  scale = 1.0,
  onLoad,
  onError,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    const err = new Error("Failed to load image");
    setError(err);
    setLoading(false);
    onError?.(err);
  };

  if (loading) {
    return <LoadingPlaceholder />;
  }

  if (error) {
    return <BrokenImagePlaceholder />;
  }

  return (
    <div className="image-preview">
      <img
        src={url}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          transform: `scale(${scale})`,
          objectFit: "contain",
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      />
    </div>
  );
};
```

### 5. Text Preview Component

```typescript
// frontend/src/components/FilePreview/TextPreview.tsx
export interface TextPreviewProps {
  url: string;
  onLoad?: (content: string) => void;
  onError?: (error: Error) => void;
}

export const TextPreview: React.FC<TextPreviewProps> = ({
  url,
  onLoad,
  onError,
}) => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchText = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
        setContent(text);
        setLoading(false);
        onLoad?.(text);
      } catch (err) {
        const error = err as Error;
        setError(error);
        setLoading(false);
        onError?.(error);
      }
    };

    fetchText();
  }, [url]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <ErrorDisplay error={error} onRetry={() => window.location.reload()} />
    );
  }

  return (
    <div className="text-preview">
      <pre style={{ whiteSpace: "pre-wrap", overflow: "auto" }}>{content}</pre>
    </div>
  );
};
```

### 6. File Preview Modal

```typescript
// frontend/src/components/FilePreview/FilePreviewModal.tsx
export interface FilePreviewModalProps {
  url: string;
  filename?: string;
  fileSize?: number;
  uploadDate?: Date;
  fileType: FileType;
  enableZoom: boolean;
  enableDownload: boolean;
  onClose?: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  url,
  filename,
  fileSize,
  uploadDate,
  fileType,
  enableZoom,
  enableDownload,
  onClose,
}) => {
  const [scale, setScale] = useState<number>(1.0);
  const [isOpen, setIsOpen] = useState<boolean>(true);

  useEffect(() => {
    // Prevent background scrolling
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setScale(1.0);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="file-preview-modal" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <ModalHeader
          filename={filename}
          fileSize={fileSize}
          uploadDate={uploadDate}
          fileType={fileType}
          onClose={handleClose}
          onDownload={enableDownload ? handleDownload : undefined}
        />

        <div className="modal-body">
          {fileType === "pdf" && <PDFPreview url={url} scale={scale} />}
          {fileType === "image" && <ImagePreview url={url} scale={scale} />}
          {fileType === "text" && <TextPreview url={url} />}
          {fileType === "unsupported" && (
            <UnsupportedFileMessage onDownload={handleDownload} />
          )}
        </div>

        {enableZoom && fileType !== "text" && (
          <ZoomControls
            scale={scale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onReset={handleZoomReset}
          />
        )}
      </div>
    </div>
  );
};
```

### 7. File Thumbnail Component

```typescript
// frontend/src/components/FilePreview/FileThumbnail.tsx
export interface FileThumbnailProps {
  url: string;
  fileType: FileType;
  maxSize: number;
  onClick?: () => void;
}

export const FileThumbnail: React.FC<FileThumbnailProps> = ({
  url,
  fileType,
  maxSize,
  onClick,
}) => {
  const [isInView, setIsInView] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="file-thumbnail"
      style={{ maxWidth: maxSize, maxHeight: maxSize }}
      onClick={onClick}
    >
      {!isInView && <ThumbnailPlaceholder />}
      {isInView && fileType === "pdf" && <PDFThumbnail url={url} />}
      {isInView && fileType === "image" && <ImageThumbnail url={url} />}
      {isInView && fileType === "text" && <FileIcon type="text" />}
      {isInView && fileType === "unsupported" && <FileIcon type="unknown" />}
    </div>
  );
};
```

### 8. Keyboard Navigation Hook

```typescript
// frontend/src/components/FilePreview/hooks/useKeyboardNavigation.ts
export interface KeyboardNavigationOptions {
  onNext?: () => void;
  onPrevious?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onClose?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    onNext,
    onPrevious,
    onZoomIn,
    onZoomOut,
    onClose,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          onNext?.();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          onPrevious?.();
          break;
        case "+":
        case "=":
          e.preventDefault();
          onZoomIn?.();
          break;
        case "-":
        case "_":
          e.preventDefault();
          onZoomOut?.();
          break;
        case "Escape":
          e.preventDefault();
          onClose?.();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onNext, onPrevious, onZoomIn, onZoomOut, onClose]);
}
```

### 9. Preview Cache Hook

```typescript
// frontend/src/components/FilePreview/hooks/usePreviewCache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class PreviewCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxAge: number;

  constructor(maxAgeMs: number = 5 * 60 * 1000) {
    this.maxAge = maxAgeMs;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

const pdfCache = new PreviewCache<any>();
const textCache = new PreviewCache<string>();

export function usePreviewCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  cacheInstance: PreviewCache<T>
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(cacheInstance.get(key));
  const [loading, setLoading] = useState<boolean>(!data);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = cacheInstance.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    fetcher()
      .then((result) => {
        cacheInstance.set(key, result);
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [key]);

  return { data, loading, error };
}
```

## Data Models

### File Metadata

```typescript
// frontend/src/components/FilePreview/types.ts
export interface FileMetadata {
  filename: string;
  fileSize: number;
  fileType: FileType;
  uploadDate?: Date;
  pageCount?: number; // For PDFs
  dimensions?: { width: number; height: number }; // For images
}

export interface PreviewState {
  loading: boolean;
  error: Error | null;
  scale: number;
  currentPage: number; // For PDFs
  totalPages: number; // For PDFs
}

export interface PreviewError {
  type: "network" | "cors" | "format" | "memory" | "unknown";
  message: string;
  originalError?: Error;
}
```

### Integration with Message Model

The FilePreview component will integrate with existing Message components:

```typescript
// Example usage in MessagesList component
import { FilePreview } from "../FilePreview/FilePreview";

const MessageItem: React.FC<{ message: Message }> = ({ message }) => {
  const [showModal, setShowModal] = useState(false);

  if (message.mediaUrl) {
    return (
      <>
        <FilePreview
          url={message.mediaUrl}
          filename={extractFilename(message.mediaUrl)}
          mode="thumbnail"
          onClick={() => setShowModal(true)}
        />

        {showModal && (
          <FilePreview
            url={message.mediaUrl}
            filename={extractFilename(message.mediaUrl)}
            fileSize={message.mediaSize}
            uploadDate={message.createdAt}
            mode="modal"
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return <div>{message.body}</div>;
};
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: PDF rendering with react-pdf

_For any_ valid PDF URL, the component should render using react-pdf's Document component
**Validates: Requirements 1.1**

### Property 2: Multi-page PDF navigation controls

_For any_ PDF with more than one page, the component should render page navigation controls
**Validates: Requirements 1.2**

### Property 3: Page navigation updates display

_For any_ PDF, clicking next/previous should update the current page number and trigger re-render
**Validates: Requirements 1.3**

### Property 4: PDF loading indicator

_For any_ PDF being loaded, the component should display a loading indicator until load completes
**Validates: Requirements 1.4**

### Property 5: PDF error handling

_For any_ PDF that fails to load, the component should display an error message with retry option
**Validates: Requirements 1.5**

### Property 6: Image rendering

_For any_ valid image URL, the component should render using an img element with correct src
**Validates: Requirements 2.1**

### Property 7: Image loading placeholder

_For any_ image being loaded, the component should display a placeholder until load completes
**Validates: Requirements 2.2**

### Property 8: Image error placeholder

_For any_ image that fails to load, the component should display a broken image placeholder
**Validates: Requirements 2.3**

### Property 9: Image aspect ratio preservation

_For any_ displayed image, the CSS should maintain the original aspect ratio
**Validates: Requirements 2.4**

### Property 10: Image zoom scaling

_For any_ image with zoom enabled, zoom controls should update the scale and apply transform
**Validates: Requirements 2.5**

### Property 11: Text content fetching and display

_For any_ text file URL, the component should fetch the content and display it
**Validates: Requirements 3.1**

### Property 12: Text loading indicator

_For any_ text file being loaded, the component should display a loading indicator
**Validates: Requirements 3.2**

### Property 13: Text error handling

_For any_ text file that fails to load, the component should display an error message
**Validates: Requirements 3.3**

### Property 14: Text formatting preservation

_For any_ text content, line breaks and whitespace should be preserved in the rendered output
**Validates: Requirements 3.4**

### Property 15: Text scrolling

_For any_ text content exceeding the display area, the container should provide scrolling
**Validates: Requirements 3.5**

### Property 16: Single component for all file types

_For any_ supported file type (PDF, image, text), the FilePreview component should handle it
**Validates: Requirements 4.1**

### Property 17: Automatic file type detection

_For any_ file URL, the component should correctly detect the file type from extension
**Validates: Requirements 4.2**

### Property 18: Configuration props acceptance

_For any_ FilePreview instance, it should accept and apply size, zoom, and control props
**Validates: Requirements 4.3**

### Property 19: Storage backend compatibility

_For any_ file URL (local or S3), the component should handle it correctly
**Validates: Requirements 4.4**

### Property 20: Modal full-screen display

_For any_ modal preview, it should render with full-screen or large dialog styling
**Validates: Requirements 5.1**

### Property 21: Modal controls presence

_For any_ modal preview, close, download, and navigation controls should be rendered
**Validates: Requirements 5.2**

### Property 22: Click-outside modal close

_For any_ modal preview, clicking the backdrop should trigger the close handler
**Validates: Requirements 5.3**

### Property 23: ESC key modal close

_For any_ modal preview, pressing ESC should trigger the close handler
**Validates: Requirements 5.4, 11.2**

### Property 24: Background scroll prevention

_For any_ open modal, body overflow should be set to hidden
**Validates: Requirements 5.5**

### Property 25: Zoom controls rendering

_For any_ preview with zoom enabled, zoom in, zoom out, and reset buttons should render
**Validates: Requirements 6.1**

### Property 26: Zoom in increases scale

_For any_ preview, clicking zoom in should increase scale by 0.25
**Validates: Requirements 6.2**

### Property 27: Zoom out decreases scale

_For any_ preview, clicking zoom out should decrease scale by 0.25
**Validates: Requirements 6.3**

### Property 28: Zoom reset restores default

_For any_ preview, clicking reset should set scale back to 1.0
**Validates: Requirements 6.4**

### Property 29: Download triggers file download

_For any_ preview with download enabled, clicking download should create and trigger a download link
**Validates: Requirements 7.1**

### Property 30: Download filename preservation

_For any_ file download, the download attribute should contain the original filename
**Validates: Requirements 7.2**

### Property 31: Download error handling

_For any_ failed download, the component should display an error message
**Validates: Requirements 7.3**

### Property 32: Download storage compatibility

_For any_ file URL (local or S3), download should work correctly
**Validates: Requirements 7.4**

### Property 33: Loading state display

_For any_ file being fetched, a loading spinner or skeleton should be displayed
**Validates: Requirements 8.1**

### Property 34: Error message display

_For any_ file load failure, a user-friendly error message should be displayed
**Validates: Requirements 8.2**

### Property 35: Retry action provision

_For any_ error state, a retry button should be rendered
**Validates: Requirements 8.3**

### Property 36: Unsupported file handling

_For any_ unsupported file type, a message with download option should be displayed
**Validates: Requirements 8.4**

### Property 37: Network error messages

_For any_ network error, an appropriate network-specific message should be displayed
**Validates: Requirements 8.5**

### Property 38: PDF thumbnail rendering

_For any_ message with PDF file, a thumbnail of the first page should be rendered
**Validates: Requirements 9.1**

### Property 39: Image thumbnail rendering

_For any_ message with image file, an image thumbnail should be rendered
**Validates: Requirements 9.2**

### Property 40: Text file icon rendering

_For any_ message with text file, a text file icon should be rendered
**Validates: Requirements 9.3**

### Property 41: Thumbnail click opens modal

_For any_ thumbnail, clicking it should trigger modal open
**Validates: Requirements 9.4**

### Property 42: Thumbnail size constraints

_For any_ thumbnail, max-width and max-height should be applied
**Validates: Requirements 9.5**

### Property 43: Media URL format compliance

_For any_ file fetch, URLs should follow the BACKEND_URL/public/<key> format or be absolute
**Validates: Requirements 10.1**

### Property 44: S3 URL handling

_For any_ S3-stored file (absolute URL), the component should handle it correctly
**Validates: Requirements 10.2**

### Property 45: Local URL handling

_For any_ locally-stored file (relative URL), the component should handle it correctly
**Validates: Requirements 10.3**

### Property 46: Storage backend resilience

_For any_ URL type change (local to S3 or vice versa), the component should continue working
**Validates: Requirements 10.4**

### Property 47: Arrow key page navigation

_For any_ multi-page PDF, arrow keys should trigger page changes
**Validates: Requirements 11.1**

### Property 48: Keyboard zoom controls

_For any_ preview with zoom, +/- keys should trigger zoom changes
**Validates: Requirements 11.3**

### Property 49: Keyboard event prevention

_For any_ keyboard shortcut, preventDefault should be called to prevent browser defaults
**Validates: Requirements 11.4**

### Property 50: Keyboard shortcuts help

_For any_ preview, a help tooltip with keyboard shortcuts should be available
**Validates: Requirements 11.5**

### Property 51: Single page rendering for PDFs

_For any_ PDF, only the current page should be rendered, not all pages
**Validates: Requirements 12.1**

### Property 52: Lazy loading thumbnails

_For any_ thumbnail, content should only load when in viewport (intersection observer)
**Validates: Requirements 12.2**

### Property 53: Preview content caching

_For any_ file, rendering it twice should use cached content on second render
**Validates: Requirements 12.5**

### Property 54: Filename display

_For any_ preview, the filename should be extracted and displayed
**Validates: Requirements 13.1**

### Property 55: File size display

_For any_ preview with file size provided, it should be displayed
**Validates: Requirements 13.2**

### Property 56: PDF page count display

_For any_ PDF, the total page count should be extracted and displayed
**Validates: Requirements 13.3**

### Property 57: File type display

_For any_ preview, the detected file type should be displayed
**Validates: Requirements 13.4**

### Property 58: Upload date display

_For any_ preview with upload date provided, it should be displayed
**Validates: Requirements 13.5**

### Property 59: React-pdf error catching

_For any_ react-pdf error, it should be caught and a fallback displayed
**Validates: Requirements 14.1**

### Property 60: CORS error messages

_For any_ CORS error, a CORS-specific error message should be displayed
**Validates: Requirements 14.2**

### Property 61: Corrupted file handling

_For any_ corrupted file, an error with download option should be displayed
**Validates: Requirements 14.3**

### Property 62: Error logging

_For any_ preview error, it should be logged to console or logging service
**Validates: Requirements 14.5**

## Error Handling

### Error Types

```typescript
// frontend/src/components/FilePreview/errors/PreviewErrors.ts
export class PreviewError extends Error {
  constructor(
    message: string,
    public readonly type: "network" | "cors" | "format" | "memory" | "unknown",
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "PreviewError";
  }
}

export class NetworkError extends PreviewError {
  constructor(originalError?: Error) {
    super(
      "Network error occurred while loading the file. Please check your connection and try again.",
      "network",
      originalError
    );
  }
}

export class CORSError extends PreviewError {
  constructor() {
    super(
      "Cross-origin request blocked. The file cannot be loaded due to CORS policy.",
      "cors"
    );
  }
}

export class FormatError extends PreviewError {
  constructor(fileType: string) {
    super(
      `The ${fileType} file appears to be corrupted or in an unsupported format.`,
      "format"
    );
  }
}

export class MemoryError extends PreviewError {
  constructor() {
    super(
      "The file is too large to preview in the browser. Please download it to view.",
      "memory"
    );
  }
}
```

### Error Boundary Component

```typescript
// frontend/src/components/FilePreview/PreviewErrorBoundary.tsx
export class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Preview error:", error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify specific components in isolation:

1. **File Type Detection**: Test detection logic for various extensions
2. **PDF Preview**: Test page navigation, loading states, error states
3. **Image Preview**: Test loading, error handling, zoom functionality
4. **Text Preview**: Test fetching, rendering, error handling
5. **Modal Component**: Test open/close, keyboard events, backdrop clicks
6. **Zoom Controls**: Test zoom in/out/reset logic
7. **Keyboard Navigation**: Test keyboard event handlers
8. **Cache Hook**: Test caching behavior and expiration

### Property-Based Testing

Property-based tests will verify universal properties across all inputs using **fast-check** library:

1. **Properties 1-62**: Each correctness property will be implemented as a property-based test
2. **Test Configuration**: Minimum 100 iterations per property test
3. **Generators**: Custom generators for:
   - Random file URLs (local and S3 formats)
   - Random file types and extensions
   - Random scale values
   - Random page numbers
4. **Tagging**: Each test tagged with `Feature: file-preview, Property N: <description>`

### Integration Testing

Integration tests will verify end-to-end workflows:

1. **Message List Integration**: Test thumbnail display in message list
2. **Modal Workflow**: Test thumbnail click → modal open → preview → close
3. **Storage Integration**: Test with both local and S3 URLs from s3-media-storage
4. **Keyboard Navigation**: Test full keyboard workflow
5. **Error Recovery**: Test retry functionality after errors

### Test Dependencies

```json
{
  "dependencies": {
    "react-pdf": "^7.x",
    "pdfjs-dist": "^3.x"
  },
  "devDependencies": {
    "@testing-library/react": "^14.x",
    "@testing-library/user-event": "^14.x",
    "fast-check": "^3.x",
    "jest": "^29.x"
  }
}
```

## Performance Considerations

### Lazy Loading

1. **Intersection Observer**: Use for thumbnail lazy loading
2. **Viewport Detection**: Only render thumbnails when visible
3. **Progressive Loading**: Load PDF pages on demand

### Caching Strategy

1. **Preview Cache**: Cache rendered content for 5 minutes
2. **PDF Document Cache**: Cache PDF.js document objects
3. **Text Content Cache**: Cache fetched text content
4. **Cache Invalidation**: Clear cache on URL change

### Memory Management

1. **Single Page Rendering**: Only render current PDF page
2. **Image Optimization**: Use appropriate image sizes for thumbnails
3. **Cleanup**: Properly cleanup event listeners and observers
4. **Blob URL Revocation**: Revoke blob URLs after download

### Bundle Size Optimization

1. **Code Splitting**: Lazy load react-pdf and PDF.js worker
2. **Tree Shaking**: Import only needed react-pdf components
3. **Worker CDN**: Load PDF.js worker from CDN

## Security Considerations

### Content Security Policy

1. **Worker Source**: Allow PDF.js worker from CDN
2. **Image Sources**: Allow images from configured storage backends
3. **Frame Ancestors**: Prevent clickjacking in modal

### URL Validation

1. **Whitelist Domains**: Only allow URLs from configured backends
2. **Path Traversal**: Validate media keys to prevent path traversal
3. **Protocol Check**: Only allow http/https protocols

### XSS Prevention

1. **Text Sanitization**: Sanitize text content before rendering
2. **Filename Escaping**: Escape filenames in download attributes
3. **Error Message Sanitization**: Sanitize error messages

## Accessibility Considerations

### Keyboard Navigation

1. **Focus Management**: Proper focus trap in modal
2. **Keyboard Shortcuts**: Documented and intuitive shortcuts
3. **Tab Order**: Logical tab order through controls

### Screen Reader Support

1. **ARIA Labels**: Proper labels for all controls
2. **ARIA Live Regions**: Announce loading and error states
3. **Alt Text**: Meaningful alt text for images
4. **Role Attributes**: Proper roles for modal and controls

### Visual Accessibility

1. **Color Contrast**: WCAG AA compliant contrast ratios
2. **Focus Indicators**: Visible focus indicators
3. **Loading States**: Clear visual feedback
4. **Error States**: Clear error messaging

## Integration Points

### With s3-media-storage Spec

The FilePreview component integrates with s3-media-storage at these points:

1. **Media URLs**: Uses URLs from Message.mediaUrl (format: BACKEND_URL/public/<key>)
2. **Storage Backend**: Works transparently with local and S3 storage
3. **Hybrid Mode**: Supports hybrid mode where old files are local, new files are S3
4. **Download**: Uses same URL format for downloads
5. **Signed URLs**: Can use S3 signed URLs when available

### With Message Components

Integration points with existing message components:

1. **MessagesList**: Add thumbnail previews for media messages
2. **MessageItem**: Replace current media display with FilePreview
3. **ContactDrawer**: Show file previews in contact media history
4. **TicketInfo**: Display file previews in ticket attachments

### With Settings

Configuration options in Settings:

1. **Preview Quality**: Configure PDF rendering quality
2. **Cache Duration**: Configure preview cache TTL
3. **Thumbnail Size**: Configure default thumbnail size
4. **Enable/Disable**: Toggle preview features per company

## Deployment Considerations

### CDN Configuration

1. **PDF.js Worker**: Configure CDN URL for worker
2. **Fallback**: Local worker fallback if CDN fails
3. **Version Pinning**: Pin PDF.js version for stability

### Browser Compatibility

1. **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
2. **Polyfills**: Intersection Observer polyfill for older browsers
3. **Fallback**: Download-only mode for unsupported browsers

### Monitoring

1. **Error Tracking**: Track preview errors by type
2. **Performance Metrics**: Monitor load times and render performance
3. **Usage Analytics**: Track preview usage by file type
4. **Cache Hit Rate**: Monitor cache effectiveness

## Future Enhancements

1. **Video Preview**: Add support for video files
2. **Audio Preview**: Add support for audio files
3. **Office Documents**: Add support for Word, Excel, PowerPoint
4. **Annotations**: Allow users to annotate PDFs
5. **Print**: Add print functionality for previews
6. **Share**: Add share functionality for files
7. **Comparison**: Side-by-side file comparison
8. **Version History**: Show file version history

## Summary

This design provides a comprehensive, reusable, and performant file preview system that seamlessly integrates with the existing s3-media-storage infrastructure. The architecture follows React best practices, Clean Architecture principles, and ensures accessibility, security, and maintainability. The component-based design allows for easy integration throughout the application while the caching and lazy loading strategies ensure optimal performance.
