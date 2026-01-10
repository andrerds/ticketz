import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import {
  IThumbnailHandlerService,
  PREVIEW_SIZE_DIMENSIONS,
  PreviewError,
  PreviewErrorCode,
  StorageLocation,
  ThumbnailOptions
} from "../../domain/preview";
import { getPublicPath } from "../../helpers/GetPublicPath";
import { SimpleObjectCache } from "../../helpers/simpleObjectCache";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "../StorageServices/GetStorageConfigService";

export class ThumbnailHandlerService implements IThumbnailHandlerService {
  private cache = new SimpleObjectCache(1000 * 60 * 15, logger); // 15-minute TTL

  private readonly DEFAULT_QUALITY = 80;

  private readonly DEFAULT_FORMAT = "jpeg";

  async generateThumbnail(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<Buffer> {
    logger.info(
      { mediaKey, storageLocation, companyId, options },
      "[THUMBNAIL] Starting thumbnail generation"
    );

    // Validate inputs
    this.validateInputs(mediaKey, companyId);

    const cacheKey = this.generateCacheKey(mediaKey, companyId, options);

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Buffer.isBuffer(cached)) {
        logger.info(
          { mediaKey, fromCache: true },
          "[THUMBNAIL] Thumbnail retrieved from cache"
        );
        return cached;
      }

      // Get original file buffer
      const originalBuffer = await this.getOriginalFileBuffer(
        mediaKey,
        storageLocation,
        companyId
      );

      // Generate thumbnail
      const thumbnailBuffer = await this.processImageToThumbnail(
        originalBuffer,
        options
      );

      // Cache the result
      this.cache.set(cacheKey, thumbnailBuffer);

      logger.info(
        { mediaKey, thumbnailSize: thumbnailBuffer.length },
        "[THUMBNAIL] Thumbnail generated successfully"
      );

      return thumbnailBuffer;
    } catch (error) {
      logger.error(
        { error: error.message, mediaKey, storageLocation, companyId },
        "[THUMBNAIL] Failed to generate thumbnail"
      );

      if (error instanceof PreviewError) {
        throw error;
      }

      throw new PreviewError(
        PreviewErrorCode.THUMBNAIL_GENERATION_FAILED,
        `Failed to generate thumbnail: ${error.message}`,
        500,
        "error",
        mediaKey,
        companyId
      );
    }
  }

  async getThumbnail(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<Buffer> {
    logger.info(
      { mediaKey, storageLocation, companyId, options },
      "[THUMBNAIL] Getting thumbnail with cache-first strategy"
    );

    const cacheKey = this.generateCacheKey(mediaKey, companyId, options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Buffer.isBuffer(cached)) {
      logger.info(
        { mediaKey, fromCache: true },
        "[THUMBNAIL] Thumbnail found in cache"
      );
      return cached;
    }

    // Check if thumbnail exists in storage
    const thumbnailKey = this.generateThumbnailKey(mediaKey, options);
    const thumbnailExists = await this.checkThumbnailExists(
      thumbnailKey,
      storageLocation,
      companyId
    );

    if (thumbnailExists) {
      try {
        const thumbnailBuffer = await this.getOriginalFileBuffer(
          thumbnailKey,
          storageLocation,
          companyId
        );

        // Cache the retrieved thumbnail
        this.cache.set(cacheKey, thumbnailBuffer);

        logger.info(
          { mediaKey, thumbnailKey },
          "[THUMBNAIL] Existing thumbnail retrieved from storage"
        );

        return thumbnailBuffer;
      } catch (error) {
        logger.warn(
          { error: error.message, mediaKey, thumbnailKey },
          "[THUMBNAIL] Failed to retrieve existing thumbnail, will generate new one"
        );
      }
    }

    // Try to generate new thumbnail
    try {
      return await this.generateThumbnail(
        mediaKey,
        storageLocation,
        companyId,
        options
      );
    } catch (error) {
      logger.warn(
        { error: error.message, mediaKey },
        "[THUMBNAIL] Thumbnail generation failed, trying fallback strategies"
      );

      // Fallback 1: Try to return original file if it's an image
      try {
        const originalBuffer = await this.getOriginalFileBuffer(
          mediaKey,
          storageLocation,
          companyId
        );

        // Check if it's a supported image format
        if (await this.isImageFile(originalBuffer)) {
          logger.info(
            { mediaKey },
            "[THUMBNAIL] Returning original file as thumbnail fallback"
          );
          return originalBuffer;
        }
      } catch (originalError) {
        logger.warn(
          { error: originalError.message, mediaKey },
          "[THUMBNAIL] Failed to retrieve original file for fallback"
        );
      }

      // Fallback 2: Return placeholder image
      return await this.getPlaceholderImage();
    }
  }

  async cacheThumbnail(
    mediaKey: string,
    thumbnailBuffer: Buffer,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<void> {
    logger.info(
      {
        mediaKey,
        storageLocation,
        companyId,
        bufferSize: thumbnailBuffer.length
      },
      "[THUMBNAIL] Caching thumbnail to storage"
    );

    const thumbnailKey = this.generateThumbnailKey(mediaKey, options);
    const cacheKey = this.generateCacheKey(mediaKey, companyId, options);

    try {
      // Cache in memory
      this.cache.set(cacheKey, thumbnailBuffer);

      // Cache in storage
      if (storageLocation === "s3") {
        await this.cacheThumbnailToS3(thumbnailKey, thumbnailBuffer, companyId);
      } else {
        await this.cacheThumbnailToLocal(thumbnailKey, thumbnailBuffer);
      }

      logger.info(
        { mediaKey, thumbnailKey },
        "[THUMBNAIL] Thumbnail cached successfully"
      );
    } catch (error) {
      logger.error(
        { error: error.message, mediaKey, thumbnailKey },
        "[THUMBNAIL] Failed to cache thumbnail"
      );

      // Don't throw error for caching failures, just log them
      // The thumbnail generation was successful, caching is optional
    }
  }

  private async getOriginalFileBuffer(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number
  ): Promise<Buffer> {
    if (storageLocation === "local") {
      const fullPath = path.join(getPublicPath(), mediaKey);

      try {
        await fs.promises.access(fullPath, fs.constants.F_OK);
        return await fs.promises.readFile(fullPath);
      } catch (error) {
        throw new PreviewError(
          PreviewErrorCode.FILE_NOT_FOUND,
          `File not found in local storage: ${mediaKey}`,
          404,
          "warn",
          mediaKey,
          companyId
        );
      }
    }

    if (storageLocation === "s3") {
      const storageConfig = await GetStorageConfigService({ companyId });

      if (!storageConfig.s3Config) {
        throw new PreviewError(
          PreviewErrorCode.STORAGE_CONFIG_ERROR,
          "S3 configuration not found",
          500,
          "error",
          mediaKey,
          companyId
        );
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

      try {
        const response = await s3Client.send(
          new GetObjectCommand({
            Bucket: storageConfig.s3Config.bucket,
            Key: key
          })
        );

        if (!response.Body) {
          throw new Error("Empty response body from S3");
        }

        const chunks: Uint8Array[] = [];
        const stream = response.Body as NodeJS.ReadableStream;

        return new Promise<Buffer>((resolve, reject) => {
          stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
          stream.on("end", () => resolve(Buffer.concat(chunks)));
          stream.on("error", reject);
        });
      } catch (error) {
        throw new PreviewError(
          PreviewErrorCode.FILE_NOT_FOUND,
          `File not found in S3 storage: ${mediaKey}`,
          404,
          "warn",
          mediaKey,
          companyId
        );
      }
    }

    throw new PreviewError(
      PreviewErrorCode.INVALID_STORAGE_LOCATION,
      `Unsupported storage location: ${storageLocation}`,
      400,
      "error",
      mediaKey,
      companyId
    );
  }

  private async processImageToThumbnail(
    originalBuffer: Buffer,
    options?: ThumbnailOptions
  ): Promise<Buffer> {
    const width = options?.width || PREVIEW_SIZE_DIMENSIONS.thumbnail.width;
    const height = options?.height || PREVIEW_SIZE_DIMENSIONS.thumbnail.height;
    const quality = options?.quality || this.DEFAULT_QUALITY;
    const format = options?.format || this.DEFAULT_FORMAT;

    try {
      let sharpInstance = sharp(originalBuffer).resize(width, height, {
        fit: "inside", // Preserve aspect ratio
        withoutEnlargement: true // Don't upscale small images
      });

      // Apply format-specific processing
      switch (format.toLowerCase()) {
        case "jpeg":
        case "jpg":
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case "png":
          sharpInstance = sharpInstance.png({ quality });
          break;
        case "webp":
          sharpInstance = sharpInstance.webp({ quality });
          break;
        default:
          // Default to JPEG for unsupported formats
          sharpInstance = sharpInstance.jpeg({ quality });
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      // If sharp fails, it might not be an image or might be corrupted
      throw new PreviewError(
        PreviewErrorCode.THUMBNAIL_GENERATION_FAILED,
        `Image processing failed: ${error.message}`,
        422,
        "warn"
      );
    }
  }

  private async checkThumbnailExists(
    thumbnailKey: string,
    storageLocation: StorageLocation,
    companyId: number
  ): Promise<boolean> {
    try {
      if (storageLocation === "local") {
        const fullPath = path.join(getPublicPath(), "thumbnails", thumbnailKey);
        await fs.promises.access(fullPath, fs.constants.F_OK);
        return true;
      }

      if (storageLocation === "s3") {
        const storageConfig = await GetStorageConfigService({ companyId });

        if (!storageConfig.s3Config) {
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
          ? `${storageConfig.s3Config.prefix}/thumbnails/${thumbnailKey}`
          : `thumbnails/${thumbnailKey}`;

        await s3Client.send(
          new GetObjectCommand({
            Bucket: storageConfig.s3Config.bucket,
            Key: key
          })
        );

        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private async cacheThumbnailToLocal(
    thumbnailKey: string,
    thumbnailBuffer: Buffer
  ): Promise<void> {
    const thumbnailDir = path.join(getPublicPath(), "thumbnails");
    const thumbnailPath = path.join(thumbnailDir, thumbnailKey);

    // Ensure thumbnails directory exists
    await fs.promises.mkdir(thumbnailDir, { recursive: true });

    // Write thumbnail to file
    await fs.promises.writeFile(thumbnailPath, new Uint8Array(thumbnailBuffer));
  }

  private async cacheThumbnailToS3(
    thumbnailKey: string,
    thumbnailBuffer: Buffer,
    companyId: number
  ): Promise<void> {
    const storageConfig = await GetStorageConfigService({ companyId });

    if (!storageConfig.s3Config) {
      throw new Error("S3 configuration not found");
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
      ? `${storageConfig.s3Config.prefix}/thumbnails/${thumbnailKey}`
      : `thumbnails/${thumbnailKey}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: storageConfig.s3Config.bucket,
        Key: key,
        Body: new Uint8Array(thumbnailBuffer),
        ContentType: "image/jpeg"
      })
    );
  }

  private generateThumbnailKey(
    mediaKey: string,
    options?: ThumbnailOptions
  ): string {
    const width = options?.width || PREVIEW_SIZE_DIMENSIONS.thumbnail.width;
    const height = options?.height || PREVIEW_SIZE_DIMENSIONS.thumbnail.height;
    const quality = options?.quality || this.DEFAULT_QUALITY;

    // Extract file extension and name
    const ext = path.extname(mediaKey);
    const nameWithoutExt = path.basename(mediaKey, ext);
    const dir = path.dirname(mediaKey);

    // Generate thumbnail filename
    const thumbnailName = `${nameWithoutExt}_${width}x${height}_q${quality}.jpg`;

    return dir === "." ? thumbnailName : `${dir}/${thumbnailName}`;
  }

  private generateCacheKey(
    mediaKey: string,
    companyId: number,
    options?: ThumbnailOptions
  ): string {
    const width = options?.width || PREVIEW_SIZE_DIMENSIONS.thumbnail.width;
    const height = options?.height || PREVIEW_SIZE_DIMENSIONS.thumbnail.height;
    const quality = options?.quality || this.DEFAULT_QUALITY;

    return `thumbnail-${companyId}-${mediaKey}-${width}x${height}-q${quality}`;
  }

  private validateInputs(mediaKey: string, companyId: number): void {
    if (!mediaKey || typeof mediaKey !== "string" || mediaKey.trim() === "") {
      throw PreviewError.invalidMediaKey(mediaKey);
    }

    if (!companyId || typeof companyId !== "number" || companyId <= 0) {
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

  private async isImageFile(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!(
        metadata.format &&
        ["jpeg", "png", "webp", "gif", "tiff", "bmp"].includes(metadata.format)
      );
    } catch (error) {
      return false;
    }
  }

  private async getPlaceholderImage(): Promise<Buffer> {
    // Generate a simple placeholder image using sharp
    const width = PREVIEW_SIZE_DIMENSIONS.thumbnail.width;
    const height = PREVIEW_SIZE_DIMENSIONS.thumbnail.height;

    try {
      return await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 240, g: 240, b: 240 }
        }
      })
        .jpeg({ quality: this.DEFAULT_QUALITY })
        .toBuffer();
    } catch (error) {
      logger.error(
        { error: error.message },
        "[THUMBNAIL] Failed to generate placeholder image"
      );

      // Return a minimal buffer as last resort
      return Buffer.from(
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==",
        "base64"
      );
    }
  }
}
