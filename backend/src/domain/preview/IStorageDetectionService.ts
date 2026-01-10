export type StorageLocation = "local" | "s3";

export interface IStorageDetectionService {
  /**
   * Detects where a media file is stored (local filesystem or S3)
   * @param mediaKey The media file key/path
   * @param companyId The company ID for configuration context
   * @returns Promise resolving to storage location
   */
  detectStorageLocation(
    mediaKey: string,
    companyId: number
  ): Promise<StorageLocation>;

  /**
   * Validates that a file exists at the specified storage location
   * @param mediaKey The media file key/path
   * @param location The storage location to validate
   * @param companyId The company ID for configuration context
   * @returns Promise resolving to true if file exists
   */
  validateFileExistence(
    mediaKey: string,
    location: StorageLocation,
    companyId?: number
  ): Promise<boolean>;

  /**
   * Gets cached storage location for a media key
   * @param cacheKey The cache key for the media file
   * @returns Cached storage location or null if not cached
   */
  getCachedLocation(cacheKey: string): StorageLocation | null;

  /**
   * Sets cached storage location for a media key
   * @param cacheKey The cache key for the media file
   * @param location The storage location to cache
   */
  setCachedLocation(cacheKey: string, location: StorageLocation): void;
}
