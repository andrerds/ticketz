// Storage Detection
export {
  IStorageDetectionService,
  StorageLocation
} from "./IStorageDetectionService";

// Preview URL Generation
export {
  IPreviewURLGeneratorService,
  PreviewOptions,
  PreviewSize,
  ThumbnailOptions
} from "./IPreviewURLGeneratorService";

// Thumbnail Handling
export { IThumbnailHandlerService } from "./IThumbnailHandlerService";

// Value Objects
export { PreviewCache } from "./PreviewCache";
export { PreviewMetadata } from "./PreviewMetadata";

// Error Handling
export { PreviewError, PreviewErrorCode } from "./PreviewError";

// Enums and Constants
export {
  PREVIEW_SIZE_DIMENSIONS,
  PreviewSizeDimensions,
  PreviewSize as PreviewSizeEnum
} from "./PreviewSize";
