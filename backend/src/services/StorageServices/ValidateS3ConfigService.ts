/* eslint-disable import/no-extraneous-dependencies */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
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

const TEST_FILE_PREFIX = ".ticketz-test-";
const TEST_FILE_CONTENT = "Ticketz S3 connection test";
const TEST_FILE_CONTENT_TYPE = "text/plain";

const createS3Client = (s3Config: S3Config): S3Client => {
  return new S3Client({
    endpoint: s3Config.endpoint,
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey
    },
    forcePathStyle: s3Config.forcePathStyle
  });
};

const generateTestKey = (prefix?: string): string => {
  const prefixPath = prefix ? `${prefix}/` : "";
  return `${prefixPath}${TEST_FILE_PREFIX}${Date.now()}.txt`;
};

const performDryRunValidation = async (
  client: S3Client,
  s3Config: S3Config
): Promise<void> => {
  const command = new ListObjectsV2Command({
    Bucket: s3Config.bucket,
    MaxKeys: 1
  });

  await client.send(command);

  logger.info(
    { bucket: s3Config.bucket, endpoint: s3Config.endpoint, dryRun: true },
    "S3 configuration validated successfully"
  );
};

const performFullValidation = async (
  client: S3Client,
  s3Config: S3Config
): Promise<void> => {
  const testKey = generateTestKey(s3Config.prefix);

  await client.send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: testKey,
      Body: TEST_FILE_CONTENT,
      ContentType: TEST_FILE_CONTENT_TYPE
    })
  );

  const getResult = await client.send(
    new GetObjectCommand({
      Bucket: s3Config.bucket,
      Key: testKey
    })
  );

  const downloadedContent = await getResult.Body?.transformToString();
  if (downloadedContent !== TEST_FILE_CONTENT) {
    throw new Error("Downloaded content does not match uploaded content");
  }

  await client.send(
    new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: testKey
    })
  );

  logger.info(
    { bucket: s3Config.bucket, endpoint: s3Config.endpoint, dryRun: false },
    "S3 configuration validated successfully (full test: upload, read, delete)"
  );
};

const classifyS3Error = (
  error: any,
  s3Config: S3Config
): ValidateS3ConfigResult => {
  if (
    error.name === "InvalidAccessKeyId" ||
    error.name === "SignatureDoesNotMatch" ||
    error.Code === "InvalidAccessKeyId" ||
    error.Code === "SignatureDoesNotMatch"
  ) {
    return {
      valid: false,
      error:
        "S3 authentication failed. Please verify your accessKeyId and secretAccessKey.",
      errorCode: "ERR_S3_AUTH_FAILED"
    };
  }

  if (error.name === "NoSuchBucket" || error.Code === "NoSuchBucket") {
    return {
      valid: false,
      error: `S3 bucket '${s3Config.bucket}' not found. Please verify the bucket exists and you have access.`,
      errorCode: "ERR_S3_BUCKET_NOT_FOUND"
    };
  }

  if (
    error.name === "NetworkingError" ||
    error.code === "ENOTFOUND" ||
    error.code === "ETIMEDOUT" ||
    error.code === "ECONNREFUSED"
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
    error: `S3 validation failed: ${error.message}`,
    errorCode: "ERR_S3_VALIDATION_FAILED"
  };
};

const ValidateS3ConfigService = async ({
  s3Config,
  dryRun = false
}: ValidateS3ConfigRequest): Promise<ValidateS3ConfigResult> => {
  try {
    const client = createS3Client(s3Config);

    if (dryRun) {
      await performDryRunValidation(client, s3Config);
    } else {
      await performFullValidation(client, s3Config);
    }

    return { valid: true };
  } catch (error: unknown) {
    logger.error(
      { error, s3Config: { ...s3Config, secretAccessKey: "*****" } },
      "S3 validation failed"
    );

    return classifyS3Error(error, s3Config);
  }
};

export default ValidateS3ConfigService;
