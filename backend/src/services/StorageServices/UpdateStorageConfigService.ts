import { EncryptionService } from "../../domain/storage/EncryptionService";
import {
  ImageOptimizationConfig,
  S3Config
} from "../../domain/storage/StorageConfig";
import AppError from "../../errors/AppError";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import { getIO } from "../../libs/socket";
import Setting from "../../models/Setting";
import { logger } from "../../utils/logger";
import { getExistingS3Config, isMaskedSecret } from "./StorageCredentialUtils";
import ValidateS3ConfigService from "./ValidateS3ConfigService";

interface UpdateStorageConfigRequest {
  companyId: number;
  driver: "local" | "s3";
  s3Config?: S3Config;
  imageOptimization?: ImageOptimizationConfig;
}

const emitStorageConfigUpdate = (companyId: number, driver: string): void => {
  try {
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit("storageConfigUpdate", {
      companyId,
      driver
    });
  } catch (error) {
    logger.warn(
      { error, companyId },
      "Failed to emit storage config update event"
    );
  }
};

const persistDriverChange = async (
  companyId: number,
  driver: "local",
  imageOptimization?: ImageOptimizationConfig
): Promise<void> => {
  // Check if we're switching FROM S3 TO local - need to preserve S3 history
  const existingConfig = await getExistingS3Config(companyId);

  await Setting.upsert(
    {
      companyId,
      key: "storageDriver",
      value: driver
    },
    {
      conflictFields: ["key", "companyId"]
    }
  );

  if (imageOptimization) {
    await Setting.upsert(
      {
        companyId,
        key: "storageImageOptimization",
        value: JSON.stringify(imageOptimization)
      },
      {
        conflictFields: ["key", "companyId"]
      }
    );
  }

  // If switching from S3 to local, preserve S3 history for legacy files
  if (existingConfig) {
    const s3History = {
      hasS3History: true,
      s3DeactivatedAt: new Date(),
      legacyS3Config: existingConfig
    };

    await Setting.upsert(
      {
        companyId,
        key: "storageS3History",
        value: JSON.stringify(s3History)
      },
      {
        conflictFields: ["key", "companyId"]
      }
    );

    logger.info(
      { companyId, s3DeactivatedAt: s3History.s3DeactivatedAt },
      "S3 history preserved for legacy file access"
    );
  }

  StorageDriverFactory.clearCache(companyId);
  emitStorageConfigUpdate(companyId, driver);

  logger.info({ companyId, driver }, "Storage configuration updated");
};

const mergeWithExistingCredentials = (
  newConfig: S3Config,
  existingConfig: S3Config
): S3Config => {
  return {
    endpoint: newConfig.endpoint,
    region: newConfig.region,
    bucket: newConfig.bucket,
    accessKeyId: newConfig.accessKeyId,
    secretAccessKey: existingConfig.secretAccessKey, // Use persisted secret
    forcePathStyle: newConfig.forcePathStyle,
    prefix: newConfig.prefix
  };
};

const persistS3Config = async (
  companyId: number,
  driver: "s3",
  s3Config: S3Config,
  imageOptimization?: ImageOptimizationConfig
): Promise<void> => {
  const masterKey = process.env.STORAGE_CREDENTIALS_KEY;
  if (!masterKey) {
    throw new AppError(
      "STORAGE_CREDENTIALS_KEY environment variable is required",
      500
    );
  }

  // Persist driver setting
  await Setting.upsert(
    {
      companyId,
      key: "storageDriver",
      value: driver
    },
    {
      conflictFields: ["key", "companyId"]
    }
  );

  // Encrypt and persist S3 configuration
  const encryptedSecretAccessKey = EncryptionService.encrypt(
    s3Config.secretAccessKey,
    masterKey
  );

  const s3ConfigToStore = {
    endpoint: s3Config.endpoint,
    region: s3Config.region,
    bucket: s3Config.bucket,
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: encryptedSecretAccessKey,
    forcePathStyle: s3Config.forcePathStyle ?? false,
    prefix: s3Config.prefix
  };

  await Setting.upsert(
    {
      companyId,
      key: "storageS3Config",
      value: JSON.stringify(s3ConfigToStore)
    },
    {
      conflictFields: ["key", "companyId"]
    }
  );

  // Persist image optimization if provided
  if (imageOptimization) {
    await Setting.upsert(
      {
        companyId,
        key: "storageImageOptimization",
        value: JSON.stringify(imageOptimization)
      },
      {
        conflictFields: ["key", "companyId"]
      }
    );
  }

  StorageDriverFactory.clearCache(companyId);
  emitStorageConfigUpdate(companyId, driver);

  logger.info({ companyId, driver }, "Storage configuration updated");
};

const validateAndPersistS3Config = async (
  companyId: number,
  driver: "s3",
  s3Config: S3Config,
  imageOptimization?: ImageOptimizationConfig
): Promise<void> => {
  // Validate required fields
  const required = [
    "endpoint",
    "region",
    "bucket",
    "accessKeyId",
    "secretAccessKey"
  ];
  required.forEach(field => {
    if (!s3Config[field as keyof S3Config]) {
      throw new AppError(
        `S3 configuration missing required field: ${field}`,
        400
      );
    }
  });

  // Execute S3 validation
  const validationResult = await ValidateS3ConfigService({
    s3Config,
    dryRun: false
  });

  if (!validationResult.valid) {
    throw new AppError(validationResult.error || "S3 validation failed", 400);
  }

  await persistS3Config(companyId, driver, s3Config, imageOptimization);
};

const UpdateStorageConfigService = async ({
  companyId,
  driver,
  s3Config,
  imageOptimization
}: UpdateStorageConfigRequest): Promise<void> => {
  // Skip S3 validation if driver is local
  if (driver === "local") {
    await persistDriverChange(companyId, driver, imageOptimization);
    return;
  }

  // For S3 driver, validate required configuration
  if (!s3Config) {
    throw new AppError("S3 configuration is required when driver is s3", 400);
  }

  // Check for reactivation scenario
  const existingConfig = await getExistingS3Config(companyId);
  const isReactivation =
    existingConfig && isMaskedSecret(s3Config.secretAccessKey);

  if (isReactivation) {
    logger.info(
      { companyId },
      "Detected S3 reactivation with existing credentials - skipping validation"
    );

    // Merge masked credentials with persisted values
    const mergedConfig = mergeWithExistingCredentials(s3Config, existingConfig);
    await persistS3Config(companyId, driver, mergedConfig, imageOptimization);
  } else {
    logger.info(
      { companyId, hasExistingConfig: !!existingConfig },
      "New S3 configuration or credential modification - executing validation"
    );

    // New configuration or credential modification - validate
    await validateAndPersistS3Config(
      companyId,
      driver,
      s3Config,
      imageOptimization
    );
  }
};

export default UpdateStorageConfigService;
