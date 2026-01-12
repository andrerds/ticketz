import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "../StorageServices/GetStorageConfigService";

export interface S3FileInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
}

export interface S3DebugInfo {
  totalFiles: number;
  totalSize: number;
  files: S3FileInfo[];
  bucketName: string;
  prefix?: string;
}

export const DebugS3Service = async (
  companyId: number
): Promise<S3DebugInfo> => {
  // Allow in development, dev, or when explicitly enabled
  const allowedEnvironments = ["development", "dev", "local"];
  const isDebugEnabled = process.env.ENABLE_S3_DEBUG === "true";

  if (
    !allowedEnvironments.includes(process.env.NODE_ENV || "") &&
    !isDebugEnabled
  ) {
    throw new Error(
      "S3 debug endpoint is only available in development environment or when ENABLE_S3_DEBUG=true"
    );
  }

  logger.info({ companyId }, "[S3-DEBUG] Starting S3 debug operation");

  try {
    // Get storage configuration
    const config = await GetStorageConfigService({ companyId });

    // Check if S3 configuration exists (regardless of current driver setting)
    // This allows debugging S3 files even when driver is temporarily set to local
    if (!config.s3Config) {
      throw new Error("Company does not have S3 configuration available");
    }

    // Create S3 client
    const s3Client = new S3Client({
      endpoint: config.s3Config.endpoint,
      region: config.s3Config.region,
      credentials: {
        accessKeyId: config.s3Config.accessKeyId,
        secretAccessKey: config.s3Config.secretAccessKey
      },
      forcePathStyle: config.s3Config.forcePathStyle
    });

    const files: S3FileInfo[] = [];
    let totalSize = 0;
    let continuationToken: string | undefined;

    // List all objects in the bucket with pagination
    const listAllObjects = async (): Promise<void> => {
      const command = new ListObjectsV2Command({
        Bucket: config.s3Config!.bucket,
        Prefix: config.s3Config!.prefix || undefined,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        response.Contents.forEach(object => {
          if (object.Key && object.Size !== undefined && object.LastModified) {
            files.push({
              key: object.Key,
              size: object.Size,
              lastModified: object.LastModified,
              etag: object.ETag || ""
            });
            totalSize += object.Size;
          }
        });
      }

      continuationToken = response.NextContinuationToken;

      if (continuationToken) {
        await listAllObjects();
      }
    };

    await listAllObjects();

    const debugInfo: S3DebugInfo = {
      totalFiles: files.length,
      totalSize,
      files: files.sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
      ),
      bucketName: config.s3Config.bucket,
      prefix: config.s3Config.prefix
    };

    logger.info(
      {
        companyId,
        totalFiles: debugInfo.totalFiles,
        totalSize: debugInfo.totalSize,
        bucketName: debugInfo.bucketName
      },
      "[S3-DEBUG] S3 debug operation completed successfully"
    );

    return debugInfo;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(
      {
        error: errorMessage,
        errorStack,
        companyId
      },
      "[S3-DEBUG] S3 debug operation failed"
    );
    throw error;
  }
};
