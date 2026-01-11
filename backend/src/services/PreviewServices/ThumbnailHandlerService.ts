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

      return this.executeFallbackStrategies(
        mediaKey,
        storageLocation,
        companyId,
        options
      );
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
    const { width, height } = PREVIEW_SIZE_DIMENSIONS.thumbnail;

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

  /**
   * Execute comprehensive fallback strategies for thumbnail generation failures
   */
  private async executeFallbackStrategies(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    _options?: ThumbnailOptions
  ): Promise<Buffer> {
    logger.info(
      { mediaKey, storageLocation, companyId },
      "[THUMBNAIL] Executing fallback strategies"
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

      // Fallback 2: Check if it's a PDF and return PDF placeholder
      if (await this.isPdfFile(originalBuffer, mediaKey)) {
        logger.info(
          { mediaKey },
          "[THUMBNAIL] Detected PDF file, returning PDF placeholder"
        );
        return await this.getPdfPlaceholderImage();
      }

      // Fallback 3: Check if it's a video and return video placeholder
      if (this.isVideoFile(mediaKey)) {
        logger.info(
          { mediaKey },
          "[THUMBNAIL] Detected video file, returning video placeholder"
        );
        return await this.getVideoPlaceholderImage();
      }

      // Fallback 4: Check if it's an audio file and return audio placeholder
      if (this.isAudioFile(mediaKey)) {
        logger.info(
          { mediaKey },
          "[THUMBNAIL] Detected audio file, returning audio placeholder"
        );
        return await this.getAudioPlaceholderImage();
      }

      // Fallback 5: Return generic file placeholder
      logger.info(
        { mediaKey },
        "[THUMBNAIL] Unknown file type, returning generic file placeholder"
      );
      return await this.getGenericFilePlaceholderImage();
    } catch (originalError) {
      logger.warn(
        { error: originalError.message, mediaKey },
        "[THUMBNAIL] Failed to retrieve original file for fallback analysis"
      );
    }

    // Final fallback: Return default placeholder image
    logger.info(
      { mediaKey },
      "[THUMBNAIL] All fallback strategies failed, returning default placeholder"
    );
    return this.getPlaceholderImage();
  }

  /**
   * Check if the buffer contains a PDF file
   */
  private async isPdfFile(buffer: Buffer, mediaKey: string): Promise<boolean> {
    // Check file extension first
    const ext = path.extname(mediaKey).toLowerCase();
    if (ext === ".pdf") {
      return true;
    }

    // Check PDF magic bytes (%PDF)
    if (buffer.length >= 4) {
      const header = buffer.subarray(0, 4).toString("ascii");
      return header === "%PDF";
    }

    return false;
  }

  /**
   * Check if the file is a video based on extension
   */
  private isVideoFile(mediaKey: string): boolean {
    const ext = path.extname(mediaKey).toLowerCase();
    const videoExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
      ".mkv",
      ".m4v"
    ];
    return videoExtensions.includes(ext);
  }

  /**
   * Check if the file is an audio file based on extension
   */
  private isAudioFile(mediaKey: string): boolean {
    const ext = path.extname(mediaKey).toLowerCase();
    const audioExtensions = [
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".ogg",
      ".wma",
      ".m4a"
    ];
    return audioExtensions.includes(ext);
  }

  /**
   * Generate a PDF-specific placeholder image
   */
  private async getPdfPlaceholderImage(): Promise<Buffer> {
    const { width, height } = PREVIEW_SIZE_DIMENSIONS.thumbnail;

    try {
      // Create a red-tinted placeholder for PDFs
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 220, g: 53, b: 69 } // Bootstrap danger color
        }
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="rgba(220,53,69,0.1)"/>
                <text x="50%" y="40%" text-anchor="middle" fill="white" font-size="12" font-family="Arial">PDF</text>
                <text x="50%" y="60%" text-anchor="middle" fill="white" font-size="8" font-family="Arial">Document</text>
              </svg>`
            ),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: this.DEFAULT_QUALITY })
        .toBuffer();
    } catch (error) {
      logger.warn(
        { error: error.message },
        "[THUMBNAIL] Failed to generate PDF placeholder, using default"
      );
      return this.getPlaceholderImage();
    }
  }

  /**
   * Generate a video-specific placeholder image
   */
  private async getVideoPlaceholderImage(): Promise<Buffer> {
    const { width, height } = PREVIEW_SIZE_DIMENSIONS.thumbnail;

    try {
      // Create a blue-tinted placeholder for videos
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 13, g: 110, b: 253 } // Bootstrap primary color
        }
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="rgba(13,110,253,0.1)"/>
                <polygon points="${width / 2 - 8},${height / 2 - 6} ${
                width / 2 - 8
              },${height / 2 + 6} ${width / 2 + 8},${height / 2}" fill="white"/>
                <text x="50%" y="75%" text-anchor="middle" fill="white" font-size="8" font-family="Arial">VIDEO</text>
              </svg>`
            ),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: this.DEFAULT_QUALITY })
        .toBuffer();
    } catch (error) {
      logger.warn(
        { error: error.message },
        "[THUMBNAIL] Failed to generate video placeholder, using default"
      );
      return this.getPlaceholderImage();
    }
  }

  /**
   * Generate an audio-specific placeholder image
   */
  private async getAudioPlaceholderImage(): Promise<Buffer> {
    const { width, height } = PREVIEW_SIZE_DIMENSIONS.thumbnail;

    try {
      // Create a green-tinted placeholder for audio
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 25, g: 135, b: 84 } // Bootstrap success color
        }
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="rgba(25,135,84,0.1)"/>
                <circle cx="${width / 2}" cy="${
                height / 2 - 5
              }" r="8" fill="none" stroke="white" stroke-width="2"/>
                <path d="M${width / 2 - 3} ${height / 2 - 8} L${
                width / 2 - 3
              } ${height / 2 - 2} L${width / 2 + 3} ${height / 2 - 5} L${
                width / 2 + 3
              } ${height / 2 - 11} Z" fill="white"/>
                <text x="50%" y="75%" text-anchor="middle" fill="white" font-size="8" font-family="Arial">AUDIO</text>
              </svg>`
            ),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: this.DEFAULT_QUALITY })
        .toBuffer();
    } catch (error) {
      logger.warn(
        { error: error.message },
        "[THUMBNAIL] Failed to generate audio placeholder, using default"
      );
      return this.getPlaceholderImage();
    }
  }

  /**
   * Generate a generic file placeholder image
   */
  private async getGenericFilePlaceholderImage(): Promise<Buffer> {
    const { width, height } = PREVIEW_SIZE_DIMENSIONS.thumbnail;

    try {
      // Create a gray placeholder for generic files
      return sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 108, g: 117, b: 125 } // Bootstrap secondary color
        }
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="rgba(108,117,125,0.1)"/>
                <rect x="${width / 2 - 8}" y="${
                height / 2 - 10
              }" width="16" height="12" fill="none" stroke="white" stroke-width="2"/>
                <path d="M${width / 2 - 2} ${height / 2 - 10} L${
                width / 2 - 2
              } ${height / 2 - 6} L${width / 2 + 2} ${
                height / 2 - 6
              } Z" fill="white"/>
                <text x="50%" y="75%" text-anchor="middle" fill="white" font-size="8" font-family="Arial">FILE</text>
              </svg>`
            ),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: this.DEFAULT_QUALITY })
        .toBuffer();
    } catch (error) {
      logger.warn(
        { error: error.message },
        "[THUMBNAIL] Failed to generate generic file placeholder, using default"
      );
      return this.getPlaceholderImage();
    }
  }

  /**
   * Get the appropriate Content-Type header for a file
   */
  getContentTypeForFile(mediaKey: string, isOriginalFile = false): string {
    const ext = path.extname(mediaKey).toLowerCase();

    // If returning original file, use its actual content type
    if (isOriginalFile) {
      switch (ext) {
        case ".pdf":
          return "application/pdf";
        case ".mp4":
          return "video/mp4";
        case ".avi":
          return "video/x-msvideo";
        case ".mov":
          return "video/quicktime";
        case ".webm":
          return "video/webm";
        case ".mp3":
          return "audio/mpeg";
        case ".wav":
          return "audio/wav";
        case ".ogg":
          return "audio/ogg";
        case ".png":
          return "image/png";
        case ".jpg":
        case ".jpeg":
          return "image/jpeg";
        case ".gif":
          return "image/gif";
        case ".webp":
          return "image/webp";
        default:
          return "application/octet-stream";
      }
    }

    // For thumbnails, always return JPEG
    return "image/jpeg";
  }
}
