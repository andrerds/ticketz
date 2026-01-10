import { ThumbnailOptions } from "./IPreviewURLGeneratorService";
import { StorageLocation } from "./IStorageDetectionService";

export interface IThumbnailHandlerService {
  generateThumbnail(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<Buffer>;

  getThumbnail(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<Buffer>;

  cacheThumbnail(
    mediaKey: string,
    thumbnailBuffer: Buffer,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<void>;
}
