// eslint-disable-next-line import/no-extraneous-dependencies
import * as fc from "fast-check";
import GetStorageConfigService from "../GetStorageConfigService";
import Setting from "../../../models/Setting";

jest.mock("../../../models/Setting");

describe("GetStorageConfigService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: s3-media-storage, Property 1: Default storage driver
   * For any newly created company, the storage driver should default to "local"
   * Validates: Requirements 1.1
   */
  it("should default to local storage driver when no settings exist", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10000 }), async companyId => {
        (Setting.findAll as jest.Mock).mockResolvedValueOnce([]);

        const config = await GetStorageConfigService({ companyId });

        expect(config.driver).toBe("local");
        expect(config.companyId).toBe(companyId);
        expect(config.s3Config).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});
