export interface PreviewMetadata {
  /** The media file key/path */
  mediaKey: string;

  /** Original image width in pixels (for images) */
  originalWidth?: number;

  /** Original image height in pixels (for images) */
  originalHeight?: number;

  /** Generated thumbnail width in pixels */
  thumbnailWidth?: number;

  /** Generated thumbnail height in pixels */
  thumbnailHeight?: number;

  /** MIME type of the file */
  contentType: string;

  /** File size in bytes */
  fileSize: number;

  /** Whether a custom thumbnail was provided */
  hasCustomThumbnail: boolean;

  /** Whether a thumbnail was automatically generated */
  thumbnailGenerated: boolean;

  /** When the file was last modified */
  lastModified: Date;

  /** Company ID for multi-tenant isolation */
  companyId: number;
}
