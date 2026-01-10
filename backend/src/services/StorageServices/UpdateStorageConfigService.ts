import Setting from "../../models/Setting";
import {
  S3Config,
  ImageOptimizationConfig
} from "../../domain/storage/StorageConfig";
import { EncryptionService } from "../../domain/storage/EncryptionService";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import ValidateS3ConfigService from "./ValidateS3ConfigService";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

interface UpdateStorageConfigRequest {
  companyId: number;
  driver: "local" | "s3";
  s3Config?: S3Config;
  imageOptimization?: ImageOptimizationConfig;
}

const UpdateStorageConfigService = async ({
  companyId,
  driver,
  s3Config,
  imageOptimization
}: UpdateStorageConfigRequest): Promise<void> => {
  if (driver === "s3") {
    if (!s3Config) {
      throw new AppError("S3 configuration is required when driver is s3", 400);
    }

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

    const validationResult = await ValidateS3ConfigService({
      s3Config,
      dryRun: false
    });

    if (!validationResult.valid) {
      throw new AppError(validationResult.error || "S3 validation failed", 400);
    }
  }

  const masterKey = process.env.STORAGE_CREDENTIALS_KEY;
  if (driver === "s3" && !masterKey) {
    throw new AppError(
      "STORAGE_CREDENTIALS_KEY environment variable is required",
      500
    );
  }

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

  if (s3Config && driver === "s3") {
    const encryptedSecretAccessKey = EncryptionService.encrypt(
      s3Config.secretAccessKey,
      masterKey!
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
  }

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

  logger.info({ companyId, driver }, "Storage configuration updated");
};

export default UpdateStorageConfigService;
