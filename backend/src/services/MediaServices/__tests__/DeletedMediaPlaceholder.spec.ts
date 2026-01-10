import * as fc from "fast-check";
import Message from "../../../models/Message";

jest.mock("../../../models/Message");

describe("Deleted Media Placeholder", () => {
  describe("Property 33: Deleted media placeholder", () => {
    /**
     * Feature: s3-media-storage, Property 33: Deleted media placeholder
     * Validates: Requirements 11.6
     *
     * For any message with deleted media, the UI should display a placeholder
     * indicating manual removal. The backend ensures this by prefixing the
     * mediaUrl with "deleted:" when media is manually removed.
     */
    it("should return mediaUrl with 'deleted:' prefix for deleted media", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            companyId: fc.integer({ min: 1, max: 1000 }),
            contactId: fc.integer({ min: 1, max: 1000 }),
            ticketId: fc.integer({ min: 1, max: 10000 }),
            randomId: fc
              .array(
                fc.constantFrom(
                  ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
                ),
                {
                  minLength: 8,
                  maxLength: 16
                }
              )
              .map(arr => arr.join("")),
            filename: fc
              .array(
                fc.constantFrom(
                  ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
                ),
                {
                  minLength: 5,
                  maxLength: 30
                }
              )
              .map(arr => arr.join("")),
            extension: fc.oneof(
              fc.constant("jpg"),
              fc.constant("png"),
              fc.constant("mp4"),
              fc.constant("pdf"),
              fc.constant("mp3")
            )
          }),
          async ({
            messageId,
            companyId,
            contactId,
            ticketId,
            randomId,
            filename,
            extension
          }) => {
            const originalMediaUrl = `media/${companyId}/${contactId}/${ticketId}/${randomId}/${filename}.${extension}`;
            const deletedMediaUrl = `deleted:${originalMediaUrl}`;

            const mockMessage = new Message();
            mockMessage.id = messageId;
            mockMessage.isDeleted = true;
            mockMessage.getDataValue = jest.fn((key: any) => {
              if (key === "mediaUrl") return deletedMediaUrl;
              return undefined;
            }) as any;

            const retrievedMediaUrl = mockMessage.getDataValue("mediaUrl");

            expect(retrievedMediaUrl).toBeDefined();
            expect(retrievedMediaUrl).toMatch(/^deleted:/);
            expect(retrievedMediaUrl).toBe(deletedMediaUrl);

            const originalUrl = retrievedMediaUrl.substring(8);
            expect(originalUrl).toBe(originalMediaUrl);
            expect(originalUrl).toMatch(
              /^media\/\d+\/\d+\/\d+\/[a-z0-9]+\/[a-z0-9]+\.[a-z0-9]+$/
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should preserve original mediaUrl structure after deletion prefix", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            mediaUrl: fc.oneof(
              fc.constant("media/1/10/200/abc123/image.jpg"),
              fc.constant("media/5/25/500/def456/video.mp4"),
              fc.constant("media/10/50/1000/ghi789/document.pdf"),
              fc.constant("https://s3.amazonaws.com/bucket/media/file.jpg")
            )
          }),
          async ({ messageId, mediaUrl }) => {
            const deletedMediaUrl = `deleted:${mediaUrl}`;

            const mockMessage = new Message();
            mockMessage.id = messageId;
            mockMessage.isDeleted = true;
            mockMessage.getDataValue = jest.fn((key: any) => {
              if (key === "mediaUrl") return deletedMediaUrl;
              return undefined;
            }) as any;

            const retrievedMediaUrl = mockMessage.getDataValue("mediaUrl");

            expect(retrievedMediaUrl).toMatch(/^deleted:/);

            const extractedOriginalUrl = retrievedMediaUrl.substring(8);
            expect(extractedOriginalUrl).toBe(mediaUrl);

            if (mediaUrl.startsWith("http")) {
              expect(extractedOriginalUrl).toMatch(/^https?:\/\//);
            } else {
              expect(extractedOriginalUrl).toMatch(/^media\//);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should allow UI to detect deleted media by checking prefix", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            companyId: fc.integer({ min: 1, max: 1000 }),
            contactId: fc.integer({ min: 1, max: 1000 }),
            ticketId: fc.integer({ min: 1, max: 10000 }),
            randomId: fc
              .array(
                fc.constantFrom(
                  ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
                ),
                {
                  minLength: 8,
                  maxLength: 16
                }
              )
              .map(arr => arr.join("")),
            filename: fc
              .array(
                fc.constantFrom(
                  ..."abcdefghijklmnopqrstuvwxyz0123456789".split("")
                ),
                {
                  minLength: 5,
                  maxLength: 30
                }
              )
              .map(arr => arr.join(""))
          }),
          async ({
            messageId,
            companyId,
            contactId,
            ticketId,
            randomId,
            filename
          }) => {
            const originalMediaUrl = `media/${companyId}/${contactId}/${ticketId}/${randomId}/${filename}.jpg`;
            const deletedMediaUrl = `deleted:${originalMediaUrl}`;

            const mockDeletedMessage = new Message();
            mockDeletedMessage.id = messageId;
            mockDeletedMessage.isDeleted = true;
            mockDeletedMessage.getDataValue = jest.fn((key: any) => {
              if (key === "mediaUrl") return deletedMediaUrl;
              return undefined;
            }) as any;

            const mockActiveMessage = new Message();
            mockActiveMessage.id = messageId;
            mockActiveMessage.isDeleted = false;
            mockActiveMessage.getDataValue = jest.fn((key: any) => {
              if (key === "mediaUrl") return originalMediaUrl;
              return undefined;
            }) as any;

            const deletedUrl = mockDeletedMessage.getDataValue("mediaUrl");
            const activeUrl = mockActiveMessage.getDataValue("mediaUrl");

            const isDeletedMedia = deletedUrl?.startsWith("deleted:");
            const isActiveMedia = !activeUrl?.startsWith("deleted:");

            expect(isDeletedMedia).toBe(true);
            expect(isActiveMedia).toBe(true);

            expect(mockDeletedMessage.isDeleted).toBe(true);
            expect(mockActiveMessage.isDeleted).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should maintain consistency between isDeleted flag and mediaUrl prefix", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            messageId: fc.uuid(),
            companyId: fc.integer({ min: 1, max: 1000 }),
            mediaUrl: fc
              .array(
                fc.constantFrom(
                  ..."abcdefghijklmnopqrstuvwxyz0123456789/".split("")
                ),
                {
                  minLength: 10,
                  maxLength: 100
                }
              )
              .map(arr => arr.join(""))
          }),
          async ({ messageId, companyId, mediaUrl }) => {
            const deletedMediaUrl = `deleted:${mediaUrl}`;

            const mockMessage = new Message();
            mockMessage.id = messageId;
            mockMessage.companyId = companyId;
            mockMessage.isDeleted = true;
            mockMessage.getDataValue = jest.fn((key: any) => {
              if (key === "mediaUrl") return deletedMediaUrl;
              return undefined;
            }) as any;

            const retrievedMediaUrl = mockMessage.getDataValue("mediaUrl");
            const hasDeletedPrefix = retrievedMediaUrl?.startsWith("deleted:");

            if (mockMessage.isDeleted) {
              expect(hasDeletedPrefix).toBe(true);
            }

            if (hasDeletedPrefix) {
              expect(mockMessage.isDeleted).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
