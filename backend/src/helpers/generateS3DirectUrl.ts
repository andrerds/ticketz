import { S3Config } from "../domain/storage/StorageConfig";
import { logger } from "../utils/logger";

/**
 * Generates a direct S3 URL for legacy files when S3 is deactivated
 * but files still exist in S3 from when it was active
 */
export const generateS3DirectUrl = (
  s3Config: S3Config,
  mediaPath: string
): string => {
  try {
    const { endpoint, bucket, prefix } = s3Config;

    // Clean endpoint (remove protocol if present)
    const cleanEndpoint = endpoint.replace(/^https?:\/\//, "");

    // Build the full S3 key
    const fullKey = prefix ? `${prefix}/${mediaPath}` : mediaPath;

    // Generate direct S3 URL
    const directUrl = `https://${cleanEndpoint}/${bucket}/${fullKey}`;

    logger.info(
      {
        mediaPath,
        fullKey,
        directUrlPreview: `${directUrl.substring(0, 100)}...`,
        endpoint: cleanEndpoint,
        bucket
      },
      "[S3-DIRECT-URL] Generated direct S3 URL for legacy file"
    );

    return directUrl;
  } catch (error) {
    logger.error(
      {
        error: error.message,
        mediaPath,
        s3Config: {
          endpoint: s3Config.endpoint,
          bucket: s3Config.bucket,
          prefix: s3Config.prefix
        }
      },
      "[S3-DIRECT-URL] Failed to generate direct S3 URL"
    );
    throw new Error(`Failed to generate S3 direct URL: ${error.message}`);
  }
};
