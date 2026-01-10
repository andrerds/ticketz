// eslint-disable-next-line import/no-extraneous-dependencies
import * as fc from "fast-check";
import { IStorageDriver } from "../../domain/storage/IStorageDriver";
import { StorageConfig } from "../../domain/storage/StorageConfig";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import Ticket from "../../models/Ticket";
import GetStorageConfigService from "../../services/StorageServices/GetStorageConfigService";
import saveMediaToFile from "../saveMediaFile";

jest.mock("../../services/StorageServices/GetStorageConfigService");
jest.mock("../../infrastructure/storage/StorageDriverFactory");

const mockGetStorageConfigService =
  GetStorageConfigService as jest.MockedFunction<
    typeof GetStorageConfigService
  >;
const mockStorageDriverFactory = StorageDriverFactory as jest.Mocked<
  typeof StorageDriverFactory
>;

describe("saveMediaToFile", () => {
  let mockDriver: jest.Mocked<IStorageDriver>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDriver = {
      write: jest.fn().mockResolvedValue(undefined),
      read: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      getSignedUrl: jest.fn(),
      getFileSize: jest.fn()
    };

    mockStorageDriverFactory.createDriver = jest
      .fn()
      .mockResolvedValue(mockDriver);
  });

  /**
   * Feature: s3-media-storage, Property 6: Storage driver selection
   * For any media file save operation, the storage driver used should match the company's configured driver
   * Validates: Requirements 2.1
   */
  it("should use the correct storage driver based on company configuration", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom("local", "s3"),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom(
          "image/jpeg",
          "video/mp4",
          "audio/mpeg",
          "application/pdf"
        ),
        async (companyId, driverType, filename, mimetype) => {
          const config = new StorageConfig(
            companyId,
            driverType,
            driverType === "s3"
              ? {
                  endpoint: "https://s3.amazonaws.com",
                  region: "us-east-1",
                  bucket: "test-bucket",
                  accessKeyId: "test-key",
                  secretAccessKey: "test-secret",
                  forcePathStyle: false
                }
              : undefined,
            undefined
          );

          mockGetStorageConfigService.mockResolvedValue(config);

          const media = {
            data: Buffer.from("test data"),
            mimetype,
            filename
          };

          const mockTicket = {
            id: 1,
            companyId,
            contactId: 10
          } as Ticket;

          await saveMediaToFile(media, mockTicket);

          expect(mockGetStorageConfigService).toHaveBeenCalledWith({
            companyId
          });
          expect(mockStorageDriverFactory.createDriver).toHaveBeenCalledWith(
            config
          );
          expect(mockDriver.write).toHaveBeenCalledWith(
            expect.stringContaining(`media/${companyId}/`),
            media.data,
            mimetype
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 15: New media storage location
   * For any new media upload, the file should be stored in the currently configured storage driver
   * Validates: Requirements 4.2
   */
  it("should store new media in the configured storage driver", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom("local", "s3"),
        async (companyId, driverType) => {
          const config = new StorageConfig(
            companyId,
            driverType,
            driverType === "s3"
              ? {
                  endpoint: "https://s3.amazonaws.com",
                  region: "us-east-1",
                  bucket: "test-bucket",
                  accessKeyId: "test-key",
                  secretAccessKey: "test-secret",
                  forcePathStyle: false
                }
              : undefined,
            undefined
          );

          mockGetStorageConfigService.mockResolvedValue(config);

          const media = {
            data: Buffer.from("test media content"),
            mimetype: "image/jpeg",
            filename: "test.jpg"
          };

          await saveMediaToFile(media, companyId);

          expect(mockStorageDriverFactory.createDriver).toHaveBeenCalledWith(
            config
          );
          expect(mockDriver.write).toHaveBeenCalled();

          const writeCall = mockDriver.write.mock.calls[0];
          expect(writeCall[0]).toMatch(/^media\/\d+\//);
          expect(Buffer.isBuffer(writeCall[1])).toBe(true);
          expect(writeCall[2]).toBe(media.mimetype);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should maintain media key format with companyId, contactId, ticketId", async () => {
    const companyId = 5;
    const contactId = 10;
    const ticketId = 20;

    const config = new StorageConfig(companyId, "local", undefined, undefined);
    mockGetStorageConfigService.mockResolvedValue(config);

    const media = {
      data: Buffer.from("test"),
      mimetype: "image/jpeg",
      filename: "test.jpg"
    };

    const mockTicket = {
      id: ticketId,
      companyId,
      contactId
    } as Ticket;

    const result = await saveMediaToFile(media, mockTicket);

    expect(result).toMatch(
      new RegExp(
        `^media/${companyId}/${contactId}/${ticketId}/[a-zA-Z0-9]+/test\\.jpg$`
      )
    );
  });

  it("should maintain media key format with only companyId when destination is number", async () => {
    const companyId = 5;

    const config = new StorageConfig(companyId, "local", undefined, undefined);
    mockGetStorageConfigService.mockResolvedValue(config);

    const media = {
      data: Buffer.from("test"),
      mimetype: "image/jpeg",
      filename: "test.jpg"
    };

    const result = await saveMediaToFile(media, companyId);

    expect(result).toMatch(
      new RegExp(`^media/${companyId}/[a-zA-Z0-9]+/test\\.jpg$`)
    );
  });

  it("should generate filename when not provided", async () => {
    const companyId = 1;
    const config = new StorageConfig(companyId, "local", undefined, undefined);
    mockGetStorageConfigService.mockResolvedValue(config);

    const media = {
      data: Buffer.from("test"),
      mimetype: "image/jpeg",
      filename: ""
    };

    const result = await saveMediaToFile(media, companyId);

    expect(result).toMatch(/\.jpeg$/);
  });

  /**
   * Feature: s3-media-storage, Property 8: Storage operation error handling
   * For any storage operation failure, the system should throw an error with a clear message indicating the failure reason
   * Validates: Requirements 2.3
   */
  it("should throw clear error when storage operation fails", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom(
          "Network timeout",
          "Access denied",
          "Bucket not found",
          "Disk full"
        ),
        async (companyId, errorMessage) => {
          const config = new StorageConfig(
            companyId,
            "local",
            undefined,
            undefined
          );
          mockGetStorageConfigService.mockResolvedValue(config);

          mockDriver.write.mockRejectedValue(new Error(errorMessage));

          const media = {
            data: Buffer.from("test"),
            mimetype: "image/jpeg",
            filename: "test.jpg"
          };

          await expect(saveMediaToFile(media, companyId)).rejects.toThrow(
            `Failed to save media file: ${errorMessage}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should throw error when GetStorageConfigService fails", async () => {
    const companyId = 1;
    mockGetStorageConfigService.mockRejectedValue(
      new Error("Database connection failed")
    );

    const media = {
      data: Buffer.from("test"),
      mimetype: "image/jpeg",
      filename: "test.jpg"
    };

    await expect(saveMediaToFile(media, companyId)).rejects.toThrow(
      "Failed to save media file: Database connection failed"
    );
  });

  it("should throw error when StorageDriverFactory fails", async () => {
    const companyId = 1;
    const config = new StorageConfig(companyId, "s3", {
      endpoint: "https://s3.amazonaws.com",
      region: "us-east-1",
      bucket: "test-bucket",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
      forcePathStyle: false
    });

    mockGetStorageConfigService.mockResolvedValue(config);
    mockStorageDriverFactory.createDriver = jest
      .fn()
      .mockRejectedValue(new Error("Invalid S3 credentials"));

    const media = {
      data: Buffer.from("test"),
      mimetype: "image/jpeg",
      filename: "test.jpg"
    };

    await expect(saveMediaToFile(media, companyId)).rejects.toThrow(
      "Failed to save media file: Invalid S3 credentials"
    );
  });

  /**
   * Feature: s3-media-storage, Property 22: Upload failure prevents message creation
   * For any media upload failure, the associated message should not be created in the database
   * Validates: Requirements 7.5
   */
  it("should propagate error when upload fails to prevent message creation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),
        fc.constantFrom(
          "Network error",
          "S3 access denied",
          "Disk full",
          "Invalid credentials"
        ),
        async (companyId, errorMessage) => {
          const config = new StorageConfig(companyId, "s3", {
            endpoint: "https://s3.amazonaws.com",
            region: "us-east-1",
            bucket: "test-bucket",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            forcePathStyle: false
          });

          mockGetStorageConfigService.mockResolvedValue(config);
          mockDriver.write.mockRejectedValue(new Error(errorMessage));

          const media = {
            data: Buffer.from("test media"),
            mimetype: "image/jpeg",
            filename: "test.jpg"
          };

          const mockTicket = {
            id: 1,
            companyId,
            contactId: 10
          } as Ticket;

          let errorThrown = false;
          try {
            await saveMediaToFile(media, mockTicket);
          } catch (error) {
            errorThrown = true;
            expect(error.message).toContain("Failed to save media file");
            expect(error.message).toContain(errorMessage);
          }

          expect(errorThrown).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
