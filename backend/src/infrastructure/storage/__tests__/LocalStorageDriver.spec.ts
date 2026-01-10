import * as fc from "fast-check";
import fs from "fs";
import path from "path";
import { getPublicPath } from "../../../helpers/GetPublicPath";
import { LocalStorageDriver } from "../LocalStorageDriver";

describe("LocalStorageDriver", () => {
  let driver: LocalStorageDriver;
  const testDir = path.join(getPublicPath(), "test-media");

  beforeAll(async () => {
    driver = new LocalStorageDriver();
    await fs.promises.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    const entries = await fs.promises.readdir(testDir, { withFileTypes: true });
    await Promise.all(
      entries.map(async entry => {
        const fullPath = path.join(testDir, entry.name);
        if (entry.isDirectory()) {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(fullPath);
        }
      })
    );
  });

  /**
   * Feature: s3-media-storage, Property 7: Media key format consistency
   * For any media file, the key format should be identical regardless of whether it's stored locally or in S3
   * Validates: Requirements 2.2
   */
  it("should maintain consistent key format for all media files", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 100000 }),
          fc
            .string({ minLength: 8, maxLength: 16 })
            .map(s => s.replace(/[^a-zA-Z0-9]/g, "a")),
          fc.constantFrom("image.jpg", "video.mp4", "audio.mp3", "document.pdf")
        ),
        fc.constantFrom(
          "image/jpeg",
          "video/mp4",
          "audio/mpeg",
          "application/pdf"
        ),
        fc.uint8Array({ minLength: 10, maxLength: 1000 }),
        async (
          [companyId, contactId, ticketId, randomId, filename],
          mimetype,
          data
        ) => {
          const mediaKey = `test-media/${companyId}/${contactId}/${ticketId}/${randomId}/${filename}`;
          const buffer = Buffer.from(data);

          await driver.write(mediaKey, buffer, mimetype);

          const exists = await driver.exists(mediaKey);
          expect(exists).toBe(true);

          const fullPath = path.join(getPublicPath(), mediaKey);
          const fileExists = await fs.promises
            .access(fullPath, fs.constants.F_OK)
            .then(() => true)
            .catch(() => false);
          expect(fileExists).toBe(true);

          const readStream = await driver.read(mediaKey);
          const chunks: Uint8Array[] = [];
          for await (const chunk of readStream) {
            chunks.push(chunk as Uint8Array);
          }
          const readData = Buffer.concat(chunks);
          expect(readData.length).toBe(buffer.length);
          expect(readData.toString("hex")).toBe(buffer.toString("hex"));

          await driver.delete(mediaKey);
          const existsAfterDelete = await driver.exists(mediaKey);
          expect(existsAfterDelete).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should return null for getSignedUrl", async () => {
    const url = await driver.getSignedUrl("any/key", 3600);
    expect(url).toBeNull();
  });

  it("should get file size from local storage", async () => {
    const mediaKey = "test-media/size-test.txt";
    const testData = "Hello, World!";
    const buffer = Buffer.from(testData);

    await driver.write(mediaKey, buffer, "text/plain");

    const fileSize = await driver.getFileSize(mediaKey);

    expect(fileSize).toBe(buffer.length);
  });

  it("should return 0 when file does not exist for getFileSize", async () => {
    const fileSize = await driver.getFileSize("test-media/nonexistent.txt");
    expect(fileSize).toBe(0);
  });
});
