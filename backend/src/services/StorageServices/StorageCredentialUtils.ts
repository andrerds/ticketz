import { EncryptionService } from "../../domain/storage/EncryptionService";
import { S3Config } from "../../domain/storage/StorageConfig";
import Setting from "../../models/Setting";
import { logger } from "../../utils/logger";

const MASKED_SECRET_PATTERN = /^\*+$/;

export const isMaskedSecret = (value: string | undefined): boolean => {
  if (!value) return false;
  return MASKED_SECRET_PATTERN.test(value);
};

export const hasPersistedS3Config = async (
  companyId: number
): Promise<boolean> => {
  logger.info(
    { companyId },
    "[STORAGE-CREDENTIALS] Checking for persisted S3 configuration"
  );

  const setting = await Setting.findOne({
    where: {
      companyId,
      key: "storageS3Config"
    }
  });

  const hasConfig = !!setting?.value;

  logger.info(
    { companyId, hasConfig },
    "[STORAGE-CREDENTIALS] Persisted S3 configuration check completed"
  );

  return hasConfig;
};

export const getExistingS3Config = async (
  companyId: number
): Promise<S3Config | null> => {
  logger.info(
    { companyId },
    "[STORAGE-CREDENTIALS] Retrieving existing S3 configuration"
  );

  const setting = await Setting.findOne({
    where: {
      companyId,
      key: "storageS3Config"
    }
  });

  if (!setting?.value) {
    logger.info(
      { companyId },
      "[STORAGE-CREDENTIALS] No existing S3 configuration found"
    );
    return null;
  }

  try {
    const parsed = JSON.parse(setting.value);
    const masterKey = process.env.STORAGE_CREDENTIALS_KEY;

    if (!masterKey) {
      logger.error(
        { companyId },
        "[STORAGE-CREDENTIALS] STORAGE_CREDENTIALS_KEY environment variable is missing"
      );
      throw new Error(
        "STORAGE_CREDENTIALS_KEY environment variable is required"
      );
    }

    logger.info(
      { companyId },
      "[STORAGE-CREDENTIALS] Decrypting existing S3 configuration"
    );

    const decryptedSecretAccessKey = EncryptionService.decrypt(
      parsed.secretAccessKey,
      masterKey
    );

    const s3Config: S3Config = {
      endpoint: parsed.endpoint,
      region: parsed.region,
      bucket: parsed.bucket,
      accessKeyId: parsed.accessKeyId,
      secretAccessKey: decryptedSecretAccessKey,
      forcePathStyle: parsed.forcePathStyle ?? false,
      prefix: parsed.prefix
    };

    logger.info(
      {
        companyId,
        endpoint: s3Config.endpoint,
        region: s3Config.region,
        bucket: s3Config.bucket,
        accessKeyId: s3Config.accessKeyId,
        forcePathStyle: s3Config.forcePathStyle,
        prefix: s3Config.prefix
      },
      "[STORAGE-CREDENTIALS] Existing S3 configuration retrieved successfully"
    );

    return s3Config;
  } catch (error) {
    logger.error(
      {
        error: error.message,
        errorStack: error.stack,
        companyId
      },
      "[STORAGE-CREDENTIALS] Failed to retrieve existing S3 configuration"
    );
    throw error;
  }
};
