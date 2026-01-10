import { StorageLocation } from "./IStorageDetectionService";

export interface PreviewCache {
  /** The media file key/path */
  mediaKey: string;

  /** Where the file is stored */
  storageLocation: StorageLocation;

  /** Generated preview URL */
  previewURL: string;

  /** Generated thumbnail URL (optional) */
  thumbnailURL?: string;

  /** MIME type of the file */
  contentType: string;

  /** File size in bytes */
  fileSize: number;

  /** When this cache entry was last accessed */
  lastAccessed: Date;

  /** When this cache entry expires */
  expiresAt: Date;

  /** Company ID for multi-tenant isolation */
  companyId: number;
}
