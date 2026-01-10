import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import {
  IStorageDetectionService,
  PreviewError,
  PreviewErrorCode,
  StorageLocation
} from "../../domain/preview";
import { StorageConfig } from "../../domain/storage/StorageConfig";
import { getPublicPath } from "../../helpers/GetPublicPath";
import { SimpleObjectCache } from "../../helpers/simpleObjectCache";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "../StorageServices/GetStorageConfigService";

export class StorageDetectionService implements IStorageDetectionService {
  private cache = new SimpleObjectCache(1000 * 60 * 5, logger);

  private static validateInputs(mediaKey: string, companyId: number): void {
    if (!mediaKey || typeof mediaKey !== "string" || mediaKey.trim() === "") {
      logger.error(
        { mediaKey, companyId },
        "[STORAGE-DETECTION] Invalid media key provided"
      );
      throw PreviewError.invalidMediaKey(mediaKey);
    }

    if (!companyId || typeof companyId !== "number" || companyId <= 0) {
      logger.error(
        { mediaKey, companyId },
        "[STORAGE-DETECTION] Invalid company ID provided"
      );
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Invalid company ID provided",
        400,
        "warn",
        mediaKey,
        companyId
      );
    }
  }

  private static generateCacheKey(mediaKey: string, companyId: number): string {
    return `storage-location-${companyId}-${mediaKey}`;
  }

  private static async validateLocalFileExistence(
    mediaKey: string
  ): Promise<boolean> {
    const fullPath = path.join(getPublicPath(), mediaKey);
    await fs.promises.access(fullPath, fs.constants.F_OK);

    logger.debug(
      { mediaKey, fullPath },
      "[STORAGE-DETECTION] File exists in local storage"
    );
    return true;
  }

  async detectStorageLocation(
    mediaKey: string,
    companyId: number
  ): Promise<StorageLocation> {
    const cacheKey = StorageDetectionService.generateCacheKey(
      mediaKey,
      companyId
    );

    logger.info(
      { mediaKey, companyId, cacheKey },
      "[STORAGE-DETECTION] Starting storage location detection"
    );

    StorageDetectionService.validateInputs(mediaKey, companyId);

    const cached = this.getCachedLocation(cacheKey);
    if (cached) {
      logger.info(
        { mediaKey, companyId, location: cached, fromCache: true },
        "[STORAGE-DETECTION] Storage location retrieved from cache"
      );
      return cached;
    }

    try {
      if (/^https?:\/\//.test(mediaKey)) {
        logger.info(
          { mediaKey, companyId },
          "[STORAGE-DETECTION] Media key is absolute URL, detected as S3"
        );
        this.setCachedLocation(cacheKey, "s3");
        return "s3";
      }

      const localExists = await this.validateFileExistence(mediaKey, "local");
      if (localExists) {
        logger.info(
          { mediaKey, companyId },
          "[STORAGE-DETECTION] File found in local storage"
        );
        this.setCachedLocation(cacheKey, "local");
        return "local";
      }

      let storageConfig: StorageConfig;
      try {
        storageConfig = await GetStorageConfigService({ companyId });
      } catch (configError) {
        logger.error(
          { error: configError.message, mediaKey, companyId },
          "[STORAGE-DETECTION] Failed to get storage configuration, defaulting to local"
        );
        this.setCachedLocation(cacheKey, "local");
        return "local";
      }

      if (storageConfig.driver === "s3" && storageConfig.s3Config) {
        const s3Exists = await this.validateFileExistence(
          mediaKey,
          "s3",
          companyId
        );
        if (s3Exists) {
          logger.info(
            { mediaKey, companyId },
            "[STORAGE-DETECTION] File found in S3 storage"
          );
          this.setCachedLocation(cacheKey, "s3");
          return "s3";
        }
      }

      logger.warn(
        { mediaKey, companyId },
        "[STORAGE-DETECTION] File not found in any storage location, defaulting to local"
      );
      this.setCachedLocation(cacheKey, "local");
      return "local";
    } catch (error) {
      logger.error(
        { error: error.message, errorStack: error.stack, mediaKey, companyId },
        "[STORAGE-DETECTION] Failed to detect storage location"
      );

      if (error instanceof PreviewError) {
        throw error;
      }

      throw PreviewError.storageDetectionFailed(mediaKey, companyId);
    }
  }

  async validateFileExistence(
    mediaKey: string,
    location: StorageLocation,
    companyId?: number
  ): Promise<boolean> {
    try {
      if (location === "local") {
        return await StorageDetectionService.validateLocalFileExistence(
          mediaKey
        );
      }

      if (location === "s3" && companyId) {
        return await this.validateS3FileExistence(mediaKey, companyId);
      }

      return false;
    } catch (error) {
      logger.debug(
        { error: error.message, mediaKey, location },
        "[STORAGE-DETECTION] File does not exist in storage location"
      );
      return false;
    }
  }

  getCachedLocation(cacheKey: string): StorageLocation | null {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(
        { cacheKey, location: cached },
        "[STORAGE-DETECTION] Cache hit for storage location"
      );
    } else {
      logger.debug(
        { cacheKey },
        "[STORAGE-DETECTION] Cache miss for storage location"
      );
    }
    return cached;
  }

  setCachedLocation(cacheKey: string, location: StorageLocation): void {
    this.cache.set(cacheKey, location);
    logger.debug(
      { cacheKey, location },
      "[STORAGE-DETECTION] Storage location cached"
    );
  }

  invalidateCache(mediaKey: string, companyId: number): void {
    const cacheKey = StorageDetectionService.generateCacheKey(
      mediaKey,
      companyId
    );
    this.cache.remove(cacheKey);
    logger.info(
      { mediaKey, companyId, cacheKey },
      "[STORAGE-DETECTION] Cache invalidated for media file"
    );
  }

  clearAllCache(): void {
    this.cache = new SimpleObjectCache(1000 * 60 * 5, logger);
    logger.info("[STORAGE-DETECTION] All cache entries cleared");
  }

  private async validateS3FileExistence(
    mediaKey: string,
    companyId: number
  ): Promise<boolean> {
    const storageConfig = await GetStorageConfigService({ companyId });

    if (
      !storageConfig.s3Config ||
      !storageConfig.s3Config.bucket ||
      !storageConfig.s3Config.accessKeyId ||
      !storageConfig.s3Config.secretAccessKey
    ) {
      logger.warn(
        { mediaKey },
        "[STORAGE-DETECTION] Incomplete S3 configuration, cannot validate file existence"
      );
      return false;
    }

    const s3Client = new S3Client({
      endpoint: storageConfig.s3Config.endpoint,
      region: storageConfig.s3Config.region,
      credentials: {
        accessKeyId: storageConfig.s3Config.accessKeyId,
        secretAccessKey: storageConfig.s3Config.secretAccessKey
      },
      forcePathStyle: storageConfig.s3Config.forcePathStyle
    });

    const key = storageConfig.s3Config.prefix
      ? `${storageConfig.s3Config.prefix}/${mediaKey}`
      : mediaKey;

    await s3Client.send(
      new HeadObjectCommand({
        Bucket: storageConfig.s3Config.bucket,
        Key: key
      })
    );

    logger.debug(
      { mediaKey, bucket: storageConfig.s3Config.bucket, key },
      "[STORAGE-DETECTION] File exists in S3 storage"
    );
    return true;
  }
}
