import { IStorageDriver } from "../../domain/storage/IStorageDriver";
import { StorageConfig } from "../../domain/storage/StorageConfig";
import { LocalStorageDriver } from "./LocalStorageDriver";
import { S3StorageDriver } from "./S3StorageDriver";
import { SimpleObjectCache } from "../../helpers/simpleObjectCache";
import { logger } from "../../utils/logger";

export class StorageDriverFactory {
  private static driverCache = new SimpleObjectCache(1000 * 60 * 5, logger);

  static async createDriver(config: StorageConfig): Promise<IStorageDriver> {
    const cacheKey = `storage-driver-${config.companyId}`;

    const cached = this.driverCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let driver: IStorageDriver;

    if (config.driver === "s3") {
      driver = new S3StorageDriver(config.s3Config!);
    } else {
      driver = new LocalStorageDriver();
    }

    this.driverCache.set(cacheKey, driver);
    return driver;
  }

  static clearCache(companyId: number): void {
    const cacheKey = `storage-driver-${companyId}`;
    this.driverCache.remove(cacheKey);
  }
}
