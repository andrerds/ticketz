import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  IPreviewURLGeneratorService,
  PreviewError,
  PreviewErrorCode,
  PreviewOptions,
  StorageLocation,
  ThumbnailOptions
} from "../../domain/preview";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "../StorageServices/GetStorageConfigService";

export class PreviewURLGeneratorService implements IPreviewURLGeneratorService {
  private readonly DEFAULT_EXPIRATION = 3600; // 1 hour in seconds

  private readonly MAX_EXPIRATION = 86400; // 24 hours in seconds

  async generatePreviewURL(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: PreviewOptions
  ): Promise<string> {
    logger.info(
      { mediaKey, storageLocation, companyId, options },
      "[PREVIEW-URL] Starting preview URL generation"
    );

    // Validate input parameters
    this.validateInputs(mediaKey, companyId);

    try {
      if (storageLocation === "s3") {
        return await this.generateS3PreviewURL(mediaKey, companyId, options);
      }

      if (storageLocation === "local") {
        return this.generateLocalPreviewURL(mediaKey, options);
      }

      throw new PreviewError(
        PreviewErrorCode.INVALID_STORAGE_LOCATION,
        `Unsupported storage location: ${storageLocation}`,
        400,
        "error",
        mediaKey,
        companyId
      );
    } catch (error) {
      logger.error(
        { error: error.message, mediaKey, storageLocation, companyId },
        "[PREVIEW-URL] Failed to generate preview URL"
      );

      if (error instanceof PreviewError) {
        throw error;
      }

      throw PreviewError.urlGenerationFailed(mediaKey, companyId);
    }
  }

  async generateThumbnailURL(
    mediaKey: string,
    storageLocation: StorageLocation,
    companyId: number,
    options?: ThumbnailOptions
  ): Promise<string> {
    logger.info(
      { mediaKey, storageLocation, companyId, options },
      "[PREVIEW-URL] Starting thumbnail URL generation"
    );

    // For thumbnails, we append size parameters to the preview URL
    const previewOptions: PreviewOptions = {
      ...options,
      size: options?.size || "thumbnail",
      quality: options?.quality || 80
    };

    const baseURL = await this.generatePreviewURL(
      mediaKey,
      storageLocation,
      companyId,
      previewOptions
    );

    // Add thumbnail-specific parameters
    const url = new URL(baseURL);
    if (options?.width) url.searchParams.set("w", options.width.toString());
    if (options?.height) url.searchParams.set("h", options.height.toString());
    if (options?.quality) url.searchParams.set("q", options.quality.toString());

    const thumbnailURL = url.toString();
    logger.info(
      { mediaKey, thumbnailURL },
      "[PREVIEW-URL] Thumbnail URL generated successfully"
    );

    return thumbnailURL;
  }

  validateURLFormat(url: string): boolean {
    try {
      const parsedURL = new URL(url);

      // Basic URL validation
      if (!parsedURL.protocol || !parsedURL.hostname) {
        return false;
      }

      // Ensure protocol is HTTP or HTTPS
      if (!["http:", "https:"].includes(parsedURL.protocol)) {
        return false;
      }

      const dangerousPatterns = [
        /\.\./,
        /[<>'"]/,
        /javascript:/i,
        /data:/i,
        /vbscript:/i
      ];

      const fullURL = url.toLowerCase();
      return !dangerousPatterns.some(pattern => pattern.test(fullURL));
    } catch (error) {
      logger.debug(
        { url, error: error.message },
        "[PREVIEW-URL] URL format validation failed"
      );
      return false;
    }
  }

  private async generateS3PreviewURL(
    mediaKey: string,
    companyId: number,
    options?: PreviewOptions
  ): Promise<string> {
    // Get storage configuration
    const storageConfig = await GetStorageConfigService({ companyId });

    if (!storageConfig.s3Config) {
      throw new PreviewError(
        PreviewErrorCode.STORAGE_CONFIG_ERROR,
        "S3 configuration not found for company",
        500,
        "error",
        mediaKey,
        companyId
      );
    }

    // Validate S3 configuration
    if (
      !storageConfig.s3Config.bucket ||
      !storageConfig.s3Config.accessKeyId ||
      !storageConfig.s3Config.secretAccessKey
    ) {
      throw new PreviewError(
        PreviewErrorCode.STORAGE_CONFIG_ERROR,
        "Incomplete S3 configuration",
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

    const command = new GetObjectCommand({
      Bucket: storageConfig.s3Config.bucket,
      Key: key
    });

    // Calculate expiration time
    const expiresIn = Math.min(
      options?.expiresIn || this.DEFAULT_EXPIRATION,
      this.MAX_EXPIRATION
    );

    const signedURL = await getSignedUrl(s3Client, command, {
      expiresIn
    });

    logger.info(
      { mediaKey, bucket: storageConfig.s3Config.bucket, key, expiresIn },
      "[PREVIEW-URL] S3 signed URL generated successfully"
    );

    return signedURL;
  }

  private generateLocalPreviewURL(
    mediaKey: string,
    options?: PreviewOptions
  ): string {
    // Get the application host from environment or use localhost
    const host =
      process.env.BACKEND_URL || process.env.APP_URL || "http://localhost:3000";

    // Ensure the host doesn't end with a slash
    const baseHost = host.replace(/\/$/, "");

    // Construct the local preview URL
    const previewURL = `${baseHost}/public/media/${mediaKey}`;

    // Add query parameters if specified
    const url = new URL(previewURL);
    if (options?.size && options.size !== "full") {
      url.searchParams.set("size", options.size);
    }
    if (options?.quality && options.quality !== 100) {
      url.searchParams.set("quality", options.quality.toString());
    }

    const finalURL = url.toString();
    logger.info(
      { mediaKey, previewURL: finalURL },
      "[PREVIEW-URL] Local preview URL generated successfully"
    );

    return finalURL;
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

    const dangerousPatterns = [/\.\./, /[<>'"]/, /^\/+/, /\/+$/];

    const hasInvalidPattern = dangerousPatterns.some(pattern =>
      pattern.test(mediaKey)
    );
    if (hasInvalidPattern) {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Media key contains invalid characters",
        400,
        "warn",
        mediaKey,
        companyId
      );
    }
  }
}
