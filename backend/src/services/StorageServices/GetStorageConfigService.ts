import Setting from "../../models/Setting";
import {
  StorageConfig,
  S3Config,
  ImageOptimizationConfig
} from "../../domain/storage/StorageConfig";
import { EncryptionService } from "../../domain/storage/EncryptionService";
import { SimpleObjectCache } from "../../helpers/simpleObjectCache";
import { logger } from "../../utils/logger";

const configCache = new SimpleObjectCache(1000 * 60 * 5, logger);

interface GetStorageConfigRequest {
  companyId: number;
}

const GetStorageConfigService = async ({
  companyId
}: GetStorageConfigRequest): Promise<StorageConfig> => {
  const cacheKey = `storage-config-${companyId}`;

  const cached = configCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const settings = await Setting.findAll({
    where: {
      companyId,
      key: ["storageDriver", "storageS3Config", "storageImageOptimization"]
    }
  });

  const settingsMap = settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {} as Record<string, string>);

  const driver = (settingsMap.storageDriver as "local" | "s3") || "local";

  let s3Config: S3Config | undefined;
  if (settingsMap.storageS3Config) {
    try {
      const parsed = JSON.parse(settingsMap.storageS3Config);

      const masterKey = process.env.STORAGE_CREDENTIALS_KEY;
      if (!masterKey) {
        throw new Error(
          "STORAGE_CREDENTIALS_KEY environment variable is required"
        );
      }

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
    } catch (error) {
      logger.error({ error, companyId }, "Failed to parse S3 configuration");
      throw error;
    }
  }

  let imageOptimization: ImageOptimizationConfig | undefined;
  if (settingsMap.storageImageOptimization) {
    try {
      imageOptimization = JSON.parse(settingsMap.storageImageOptimization);
    } catch (error) {
      logger.error(
        { error, companyId },
        "Failed to parse image optimization configuration"
      );
    }
  }

  const config = new StorageConfig(
    companyId,
    driver,
    s3Config,
    imageOptimization
  );

  configCache.set(cacheKey, config);

  return config;
};

export default GetStorageConfigService;
