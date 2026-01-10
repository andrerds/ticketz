import { StorageLocation } from "./IStorageDetectionService";

export type PreviewSize = "thumbnail" | "medium" | "full";

export interface PreviewOptions {
  size?: PreviewSize;
  quality?: number;
  expiresIn?: number;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
  size?: PreviewSize;
}

export interface IPreviewURLGeneratorService {
  generatePreviewURL(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: PreviewOptions
  ): Promise<string>;

  generateThumbnailURL(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<string>;

  validateURLFormat(url: string): boolean;
}
