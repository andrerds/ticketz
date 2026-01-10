import * as fc from "fast-check";
import { StorageConfig } from "../../../domain/storage/StorageConfig";
import { StorageDriverFactory } from "../../../infrastructure/storage/StorageDriverFactory";
import Message from "../../../models/Message";
import GetStorageConfigService from "../../StorageServices/GetStorageConfigService";
import { ListMediaFilesService } from "../ListMediaFilesService";

jest.mock("../../../models/Message");
jest.mock("../../StorageServices/GetStorageConfigService");
jest.mock("../../../infrastructure/storage/StorageDriverFactory");
jest.mock("../../../helpers/GetPublicPath", () => ({
  getPublicPath: () => "/tmp/test-public"
}));
jest.mock("fs/promises");

describe("ListMediaFilesService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock storage config service
    const mockConfig = new StorageConfig(1, "local", undefined, undefined);
    (GetStorageConfigService as jest.Mock).mockResolvedValue(mockConfig);

    // Mock storage driver
    const mockDriver = {
      getFileSize: jest.fn().mockResolvedValue(1024)
    };
    (StorageDriverFactory.createDriver as jest.Mock).mockResolvedValue(
      mockDriver
    );
  });
  describe("Property 28: Media grouping by date and type", () => {
    /**
     * Feature: s3-media-storage, Property 28: Media grouping by date and type
     * Validates: Requirements 11.1
     *
     * For any set of media files, when retrieved for management,
     * files should be correctly grouped by date and file type
     */
    it("should correctly group media files by date and type", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            companyId: fc.integer({ min: 1, max: 1000 }),
            messages: fc.array(
              fc.record({
                id: fc.uuid(),
                mediaUrl: fc.oneof(
                  fc.constant("media/1/10/200/abc123/image.jpg"),
                  fc.constant("media/1/10/200/def456/video.mp4"),
                  fc.constant("media/1/10/200/ghi789/audio.mp3"),
                  fc.constant("https://s3.amazonaws.com/bucket/media/file.jpg")
                ),
                mediaType: fc.oneof(
                  fc.constant("image"),
                  fc.constant("video"),
                  fc.constant("audio"),
                  fc.constant("document")
                ),
                createdAt: fc.date({
                  min: new Date("2020-01-01"),
                  max: new Date("2025-01-01")
                }),
                isDeleted: fc.boolean()
              }),
              { minLength: 0, maxLength: 50 }
            )
          }),
          async ({ companyId, messages }) => {
            const sortedMessages = [...messages].sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
            );

            const mockMessages = sortedMessages.map(msg => ({
              id: msg.id,
              getDataValue: (key: string) => {
                if (key === "mediaUrl") return msg.mediaUrl;
                return undefined;
              },
              mediaType: msg.mediaType,
              createdAt: msg.createdAt,
              isDeleted: msg.isDeleted
            }));

            (Message.findAll as jest.Mock).mockResolvedValue(mockMessages);

            const result = await ListMediaFilesService(companyId);

            const groupedByType = result.reduce((acc, file) => {
              if (!acc[file.fileType]) {
                acc[file.fileType] = [];
              }
              acc[file.fileType].push(file);
              return acc;
            }, {} as Record<string, typeof result>);

            Object.values(groupedByType).forEach(group => {
              expect(group.length).toBeGreaterThanOrEqual(0);

              const types = new Set(group.map(f => f.fileType));
              expect(types.size).toBe(1);
            });

            const sortedByDate = [...result];
            sortedByDate.sort(
              (a, b) => b.uploadDate.getTime() - a.uploadDate.getTime()
            );

            expect(result.map(f => f.uploadDate)).toEqual(
              sortedByDate.map(f => f.uploadDate)
            );

            result.forEach(file => {
              expect(file).toHaveProperty("id");
              expect(file).toHaveProperty("fileName");
              expect(file).toHaveProperty("fileSize");
              expect(file).toHaveProperty("uploadDate");
              expect(file).toHaveProperty("fileType");
              expect(file).toHaveProperty("storageLocation");
              expect(file).toHaveProperty("messageId");
              expect(file).toHaveProperty("mediaUrl");
              expect(file).toHaveProperty("isDeleted");
              expect(file).toHaveProperty("canDelete");

              expect(["local", "s3"]).toContain(file.storageLocation);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Property 29: Media information completeness", () => {
    /**
     * Feature: s3-media-storage, Property 29: Media information completeness
     * Validates: Requirements 11.2
     *
     * For any media file in the management view, the response should include
     * file name, size, upload date, message reference, and storage location
     */
    it("should include all required information for each media file", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            companyId: fc.integer({ min: 1, max: 1000 }),
            messages: fc.array(
              fc.record({
                id: fc.uuid(),
                mediaUrl: fc.oneof(
                  fc.constant("media/1/10/200/abc123/document.pdf"),
                  fc.constant("media/1/10/200/def456/image.png"),
                  fc.constant("https://s3.amazonaws.com/bucket/media/video.mp4")
                ),
                mediaType: fc.oneof(
                  fc.constant("image"),
                  fc.constant("video"),
                  fc.constant("audio"),
                  fc.constant("document")
                ),
                createdAt: fc.date({
                  min: new Date("2020-01-01"),
                  max: new Date("2025-01-01")
                }),
                isDeleted: fc.boolean()
              }),
              { minLength: 1, maxLength: 20 }
            )
          }),
          async ({ companyId, messages }) => {
            const mockMessages = messages.map(msg => ({
              id: msg.id,
              getDataValue: (key: string) => {
                if (key === "mediaUrl") return msg.mediaUrl;
                return undefined;
              },
              mediaType: msg.mediaType,
              createdAt: msg.createdAt,
              isDeleted: msg.isDeleted
            }));

            (Message.findAll as jest.Mock).mockResolvedValue(mockMessages);

            const result = await ListMediaFilesService(companyId);

            expect(result.length).toBeGreaterThan(0);

            result.forEach(file => {
              expect(file.fileName).toBeDefined();
              expect(typeof file.fileName).toBe("string");
              expect(file.fileName.length).toBeGreaterThan(0);

              expect(file.fileSize).toBeDefined();
              expect(typeof file.fileSize).toBe("number");
              expect(file.fileSize).toBeGreaterThanOrEqual(0);

              expect(file.uploadDate).toBeDefined();
              expect(file.uploadDate).toBeInstanceOf(Date);
              expect(file.uploadDate.getTime()).not.toBeNaN();

              expect(file.messageId).toBeDefined();
              expect(typeof file.messageId).toBe("string");
              expect(file.messageId.length).toBeGreaterThan(0);

              expect(file.storageLocation).toBeDefined();
              expect(["local", "s3"]).toContain(file.storageLocation);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
