import * as fc from "fast-check";
import { StorageDriverFactory } from "../../../infrastructure/storage/StorageDriverFactory";
import Message from "../../../models/Message";
import GetStorageConfigService from "../../StorageServices/GetStorageConfigService";
import { DeleteMediaFileService } from "../DeleteMediaFileService";

jest.mock("../../../models/Message");
jest.mock("../../StorageServices/GetStorageConfigService");
jest.mock("../../../infrastructure/storage/StorageDriverFactory");
jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe("DeleteMediaFileService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Property 30: Age-based deletion permission", () => {
    /**
     * Feature: s3-media-storage, Property 30: Age-based deletion permission
     * Validates: Requirements 11.3
     *
     * For any media file older than 30 days, the system should allow deletion
     */
    it("should allow deletion of media files older than 30 days", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            companyId: fc.integer({ min: 1, max: 1000 }),
            userId: fc.integer({ min: 1, max: 1000 }),
            daysOld: fc.integer({ min: 31, max: 365 })
          }),
          async ({ messageId, companyId, userId, daysOld }) => {
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysOld);

            const mediaUrl = `media/${companyId}/10/200/abc123/file.jpg`;

            const mockMessage = {
              id: messageId,
              companyId,
              createdAt,
              getDataValue: jest.fn((key: string) => {
                if (key === "mediaUrl") return mediaUrl;
                return undefined;
              }),
              update: jest.fn().mockResolvedValue(undefined)
            };

            (Message.findOne as jest.Mock).mockResolvedValue(mockMessage);

            const mockConfig = {
              companyId,
              driver: "local" as const,
              s3Config: undefined,
              imageOptimization: undefined
            };

            (GetStorageConfigService as jest.Mock).mockResolvedValue(
              mockConfig
            );

            const mockDriver = {
              delete: jest.fn().mockResolvedValue(undefined)
            };

            (StorageDriverFactory.createDriver as jest.Mock).mockResolvedValue(
              mockDriver
            );

            const result = await DeleteMediaFileService({
              messageId,
              companyId,
              userId
            });

            expect(result.success).toBe(true);
            expect(result.messageId).toBe(messageId);
            expect(result.error).toBeUndefined();

            expect(mockMessage.update).toHaveBeenCalledWith({
              isDeleted: true,
              mediaUrl: `deleted:${mediaUrl}`
            });

            expect(mockDriver.delete).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 31: Recent file protection", () => {
    /**
     * Feature: s3-media-storage, Property 31: Recent file protection
     * Validates: Requirements 11.4
     *
     * For any media file newer than 30 days, the system should prevent deletion
     */
    it("should prevent deletion of media files newer than 30 days", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            companyId: fc.integer({ min: 1, max: 1000 }),
            userId: fc.integer({ min: 1, max: 1000 }),
            daysOld: fc.integer({ min: 0, max: 29 })
          }),
          async ({ messageId, companyId, userId, daysOld }) => {
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysOld);

            const mediaUrl = `media/${companyId}/10/200/abc123/file.jpg`;

            const mockMessage = {
              id: messageId,
              companyId,
              createdAt,
              getDataValue: jest.fn((key: string) => {
                if (key === "mediaUrl") return mediaUrl;
                return undefined;
              }),
              update: jest.fn().mockResolvedValue(undefined)
            };

            (Message.findOne as jest.Mock).mockResolvedValue(mockMessage);

            const result = await DeleteMediaFileService({
              messageId,
              companyId,
              userId
            });

            expect(result.success).toBe(false);
            expect(result.messageId).toBe(messageId);
            expect(result.error).toBe(
              "Cannot delete media files newer than 30 days"
            );

            expect(mockMessage.update).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 32: Deleted media marking", () => {
    /**
     * Feature: s3-media-storage, Property 32: Deleted media marking
     * Validates: Requirements 11.5
     *
     * For any media file deletion, the associated message's mediaUrl should be marked as deleted
     */
    it("should mark message mediaUrl as deleted with 'deleted:' prefix", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            companyId: fc.integer({ min: 1, max: 1000 }),
            userId: fc.integer({ min: 1, max: 1000 }),
            daysOld: fc.integer({ min: 31, max: 365 }),
            contactId: fc.integer({ min: 1, max: 1000 }),
            ticketId: fc.integer({ min: 1, max: 10000 }),
            randomId: fc.string({ minLength: 8, maxLength: 16 }),
            filename: fc.string({ minLength: 5, maxLength: 30 })
          }),
          async ({
            messageId,
            companyId,
            userId,
            daysOld,
            contactId,
            ticketId,
            randomId,
            filename
          }) => {
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysOld);

            const mediaUrl = `media/${companyId}/${contactId}/${ticketId}/${randomId}/${filename}.jpg`;

            const mockMessage = {
              id: messageId,
              companyId,
              createdAt,
              getDataValue: jest.fn((key: string) => {
                if (key === "mediaUrl") return mediaUrl;
                return undefined;
              }),
              update: jest.fn().mockResolvedValue(undefined)
            };

            (Message.findOne as jest.Mock).mockResolvedValue(mockMessage);

            const mockConfig = {
              companyId,
              driver: "local" as const,
              s3Config: undefined,
              imageOptimization: undefined
            };

            (GetStorageConfigService as jest.Mock).mockResolvedValue(
              mockConfig
            );

            const mockDriver = {
              delete: jest.fn().mockResolvedValue(undefined)
            };

            (StorageDriverFactory.createDriver as jest.Mock).mockResolvedValue(
              mockDriver
            );

            const result = await DeleteMediaFileService({
              messageId,
              companyId,
              userId
            });

            expect(result.success).toBe(true);

            expect(mockMessage.update).toHaveBeenCalledWith({
              isDeleted: true,
              mediaUrl: `deleted:${mediaUrl}`
            });

            const updateCall = mockMessage.update.mock.calls[0][0];
            expect(updateCall.isDeleted).toBe(true);
            expect(updateCall.mediaUrl).toMatch(/^deleted:/);
            expect(updateCall.mediaUrl).toBe(`deleted:${mediaUrl}`);
            expect(updateCall.mediaUrl.substring(8)).toBe(mediaUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
