/* eslint-disable import/no-extraneous-dependencies */
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { S3Config } from "../../domain/storage/StorageConfig";
import { logger } from "../../utils/logger";

interface ValidateS3ConfigRequest {
  s3Config: S3Config;
  dryRun?: boolean;
}

interface ValidateS3ConfigResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

const ValidateS3ConfigService = async ({
  s3Config,
  dryRun = false
}: ValidateS3ConfigRequest): Promise<ValidateS3ConfigResult> => {
  try {
    const client = new S3Client({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey
      },
      forcePathStyle: s3Config.forcePathStyle
    });

    const command = new ListObjectsV2Command({
      Bucket: s3Config.bucket,
      MaxKeys: 1
    });

    await client.send(command);

    logger.info(
      { bucket: s3Config.bucket, endpoint: s3Config.endpoint, dryRun },
      "S3 configuration validated successfully"
    );

    return { valid: true };
  } catch (error: unknown) {
    const err = error as any;
    logger.error(
      { error, s3Config: { ...s3Config, secretAccessKey: "*****" } },
      "S3 validation failed"
    );

    if (
      err.name === "InvalidAccessKeyId" ||
      err.name === "SignatureDoesNotMatch" ||
      err.Code === "InvalidAccessKeyId" ||
      err.Code === "SignatureDoesNotMatch"
    ) {
      return {
        valid: false,
        error:
          "S3 authentication failed. Please verify your accessKeyId and secretAccessKey.",
        errorCode: "ERR_S3_AUTH_FAILED"
      };
    }

    if (err.name === "NoSuchBucket" || err.Code === "NoSuchBucket") {
      return {
        valid: false,
        error: `S3 bucket '${s3Config.bucket}' not found. Please verify the bucket exists and you have access.`,
        errorCode: "ERR_S3_BUCKET_NOT_FOUND"
      };
    }

    if (
      err.name === "NetworkingError" ||
      err.code === "ENOTFOUND" ||
      err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED"
    ) {
      return {
        valid: false,
        error:
          "Network connectivity to S3 failed. Please check your connection and try again.",
        errorCode: "ERR_S3_NETWORK_FAILED"
      };
    }

    return {
      valid: false,
      error: `S3 validation failed: ${err.message}`,
      errorCode: "ERR_S3_VALIDATION_FAILED"
    };
  }
};

export default ValidateS3ConfigService;
