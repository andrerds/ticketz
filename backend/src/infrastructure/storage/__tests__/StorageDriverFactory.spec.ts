import * as fc from "fast-check";
import { StorageDriverFactory } from "../StorageDriverFactory";
import { StorageConfig } from "../../../domain/storage/StorageConfig";
import { LocalStorageDriver } from "../LocalStorageDriver";
import { S3StorageDriver } from "../S3StorageDriver";

describe("StorageDriverFactory", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: s3-media-storage, Property 6: Storage driver selection
   * For any media file save operation, the storage driver used should match the company's configured driver
   * Validates: Requirements 2.1
   */
  it("should create correct driver based on configuration", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom("local", "s3"),
        async (companyId, driverType) => {
          StorageDriverFactory.clearCache(companyId);

          let config: StorageConfig;

          if (driverType === "s3") {
            config = new StorageConfig(
              companyId,
              "s3",
              {
                endpoint: "https://s3.amazonaws.com",
                region: "us-east-1",
                bucket: "test-bucket",
                accessKeyId: "test-key",
                secretAccessKey: "test-secret",
                forcePathStyle: false
              },
              undefined
            );
          } else {
            config = new StorageConfig(
              companyId,
              "local",
              undefined,
              undefined
            );
          }

          const driver = await StorageDriverFactory.createDriver(config);

          if (driverType === "s3") {
            expect(driver).toBeInstanceOf(S3StorageDriver);
          } else {
            expect(driver).toBeInstanceOf(LocalStorageDriver);
          }

          const cachedDriver = await StorageDriverFactory.createDriver(config);
          expect(cachedDriver).toBe(driver);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should return cached driver for same company", async () => {
    const companyId = 1;
    const config = new StorageConfig(companyId, "local", undefined, undefined);

    StorageDriverFactory.clearCache(companyId);

    const driver1 = await StorageDriverFactory.createDriver(config);
    const driver2 = await StorageDriverFactory.createDriver(config);

    expect(driver1).toBe(driver2);
  });

  it("should clear cache for specific company", async () => {
    const companyId = 1;
    const config = new StorageConfig(companyId, "local", undefined, undefined);

    StorageDriverFactory.clearCache(companyId);

    const driver1 = await StorageDriverFactory.createDriver(config);

    StorageDriverFactory.clearCache(companyId);

    const driver2 = await StorageDriverFactory.createDriver(config);

    expect(driver1).not.toBe(driver2);
  });

  it("should create different drivers for different companies", async () => {
    const config1 = new StorageConfig(1, "local", undefined, undefined);
    const config2 = new StorageConfig(2, "local", undefined, undefined);

    StorageDriverFactory.clearCache(1);
    StorageDriverFactory.clearCache(2);

    const driver1 = await StorageDriverFactory.createDriver(config1);
    const driver2 = await StorageDriverFactory.createDriver(config2);

    expect(driver1).not.toBe(driver2);
  });
});

/**
 * Feature: s3-media-storage, Property 9: Configuration caching
 * For any company, when storage configuration is retrieved multiple times within the cache TTL, the database should only be queried once
 * Validates: Requirements 2.4
 */
it("should cache drivers and return same instance within TTL", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 1000 }), async companyId => {
      StorageDriverFactory.clearCache(companyId);

      const config = new StorageConfig(
        companyId,
        "local",
        undefined,
        undefined
      );

      const driver1 = await StorageDriverFactory.createDriver(config);
      const driver2 = await StorageDriverFactory.createDriver(config);
      const driver3 = await StorageDriverFactory.createDriver(config);

      expect(driver1).toBe(driver2);
      expect(driver2).toBe(driver3);
    }),
    { numRuns: 100 }
  );
});
