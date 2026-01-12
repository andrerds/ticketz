import { EncryptionService } from "../../domain/storage/EncryptionService";
import {
  ImageOptimizationConfig,
  S3Config,
  S3HistoryConfig,
  StorageConfig
} from "../../domain/storage/StorageConfig";
import { SimpleObjectCache } from "../../helpers/simpleObjectCache";
import Setting from "../../models/Setting";
import { logger } from "../../utils/logger";

const configCache = new SimpleObjectCache(1000 * 60 * 5, logger);

interface GetStorageConfigRequest {
  companyId: number;
}

const GetStorageConfigService = async ({
  companyId
}: GetStorageConfigRequest): Promise<StorageConfig> => {
  const cacheKey = `storage-config-${companyId}`;

  logger.info(
    { companyId, cacheKey },
    "[STORAGE-CONFIG] Retrieving storage configuration"
  );

  const cached = configCache.get(cacheKey);
  if (cached) {
    logger.info(
      {
        companyId,
        driver: cached.driver,
        hasS3Config: !!cached.s3Config,
        fromCache: true
      },
      "[STORAGE-CONFIG] Storage configuration retrieved from cache"
    );
    return cached;
  }

  logger.info(
    { companyId },
    "[STORAGE-CONFIG] Fetching storage configuration from database"
  );

  const settings = await Setting.findAll({
    where: {
      companyId,
      key: [
        "storageDriver",
        "storageS3Config",
        "storageImageOptimization",
        "storageS3History"
      ]
    }
  });

  logger.info(
    { companyId, settingsCount: settings.length },
    "[STORAGE-CONFIG] Settings fetched from database"
  );

  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string>);

  const driver = (settingsMap.storageDriver as "local" | "s3") || "local";

  logger.info(
    {
      companyId,
      driver,
      hasS3Config: !!settingsMap.storageS3Config,
      hasImageOptimization: !!settingsMap.storageImageOptimization
    },
    "[STORAGE-CONFIG] Processing storage settings"
  );

  let s3Config: S3Config | undefined;
  if (settingsMap.storageS3Config) {
    try {
      const parsed = JSON.parse(settingsMap.storageS3Config);

      logger.info(
        {
          companyId,
          endpoint: parsed.endpoint,
          region: parsed.region,
          bucket: parsed.bucket,
          accessKeyId: parsed.accessKeyId,
          forcePathStyle: parsed.forcePathStyle,
          prefix: parsed.prefix,
          hasSecretKey: !!parsed.secretAccessKey
        },
        "[STORAGE-CONFIG] Parsed S3 configuration"
      );

      const masterKey = process.env.STORAGE_CREDENTIALS_KEY;
      if (!masterKey) {
        logger.error(
          { companyId },
          "[STORAGE-CONFIG] STORAGE_CREDENTIALS_KEY environment variable is missing"
        );
        throw new Error(
          "STORAGE_CREDENTIALS_KEY environment variable is required"
        );
      }

      logger.info(
        { companyId },
        "[STORAGE-CONFIG] Decrypting S3 secret access key"
      );

      const decryptedSecretAccessKey = EncryptionService.decrypt(
        parsed.secretAccessKey,
        masterKey
      );

      s3Config = {
        endpoint: parsed.endpoint,
        region: parsed.region,
        bucket: parsed.bucket,
        accessKeyId: parsed.accessKeyId,
        secretAccessKey: decryptedSecretAccessKey,
        forcePathStyle: parsed.forcePathStyle ?? false,
        prefix: parsed.prefix
      };

      logger.info(
        { companyId, bucket: s3Config.bucket, endpoint: s3Config.endpoint },
        "[STORAGE-CONFIG] S3 configuration decrypted successfully"
      );
    } catch (error) {
      logger.error(
        { error: error.message, errorStack: error.stack, companyId },
        "[STORAGE-CONFIG] Failed to parse S3 configuration"
      );
      throw error;
    }
  }

  let imageOptimization: ImageOptimizationConfig | undefined;
  if (settingsMap.storageImageOptimization) {
    try {
      imageOptimization = JSON.parse(settingsMap.storageImageOptimization);
      logger.info(
        { companyId, imageOptimization },
        "[STORAGE-CONFIG] Image optimization configuration parsed"
      );
    } catch (error) {
      logger.error(
        { error: error.message, companyId },
        "[STORAGE-CONFIG] Failed to parse image optimization configuration"
      );
    }
  }

  let s3History: S3HistoryConfig | undefined;
  if (settingsMap.storageS3History) {
    try {
      const parsed = JSON.parse(settingsMap.storageS3History);
      s3History = {
        hasS3History: parsed.hasS3History || false,
        s3DeactivatedAt: parsed.s3DeactivatedAt
          ? new Date(parsed.s3DeactivatedAt)
          : undefined,
        legacyS3Config: parsed.legacyS3Config
      };
      logger.info(
        {
          companyId,
          hasS3History: s3History.hasS3History,
          s3DeactivatedAt: s3History.s3DeactivatedAt
        },
        "[STORAGE-CONFIG] S3 history configuration parsed"
      );
    } catch (error) {
      logger.error(
        { error: error.message, companyId },
        "[STORAGE-CONFIG] Failed to parse S3 history configuration"
      );
    }
  }

  const config = new StorageConfig(
    companyId,
    driver,
    s3Config,
    imageOptimization,
    s3History
  );

  configCache.set(cacheKey, config);

  logger.info(
    {
      companyId,
      driver: config.driver,
      hasS3Config: !!config.s3Config,
      hasImageOptimization: !!config.imageOptimization
    },
    "[STORAGE-CONFIG] Storage configuration created and cached"
  );

  return config;
};

export const clearStorageConfigCache = (companyId: number): void => {
  const cacheKey = `storage-config-${companyId}`;
  configCache.remove(cacheKey);
  logger.info({ companyId }, "[STORAGE-CONFIG] Cache cleared for company");
};

export default GetStorageConfigService;
