import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import * as fc from "fast-check";
import { Readable } from "stream";
import { S3Config } from "../../../domain/storage/StorageConfig";
import { S3StorageDriver } from "../S3StorageDriver";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");

describe("S3StorageDriver", () => {
  let driver: S3StorageDriver;
  let mockS3Client: any;

  const mockConfig: S3Config = {
    endpoint: "https://s3.amazonaws.com",
    region: "us-east-1",
    bucket: "test-bucket",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    forcePathStyle: false,
    prefix: "media"
  };

  beforeEach(() => {
    mockS3Client = {
      send: jest.fn()
    };

    (S3Client as jest.MockedClass<typeof S3Client>).mockImplementation(
      () => mockS3Client
    );

    driver = new S3StorageDriver(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: s3-media-storage, Property 7: Media key format consistency
   * For any media file, the key format should be identical regardless of whether it's stored locally or in S3
   * Validates: Requirements 2.2
   */
  it("should maintain consistent key format with prefix for all media files", async () => {
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
          mockS3Client.send.mockClear();

          const mediaKey = `${companyId}/${contactId}/${ticketId}/${randomId}/${filename}`;
          const buffer = Buffer.from(data);

          mockS3Client.send.mockResolvedValueOnce({});
          await driver.write(mediaKey, buffer, mimetype);
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
          expect(mockS3Client.send.mock.calls[0][0]).toBeInstanceOf(
            PutObjectCommand
          );

          mockS3Client.send.mockClear();
          mockS3Client.send.mockResolvedValueOnce({});
          const exists = await driver.exists(mediaKey);
          expect(exists).toBe(true);
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
          expect(mockS3Client.send.mock.calls[0][0]).toBeInstanceOf(
            HeadObjectCommand
          );

          mockS3Client.send.mockClear();
          const mockStream = Readable.from([buffer]);
          mockS3Client.send.mockResolvedValueOnce({ Body: mockStream });
          const readStream = await driver.read(mediaKey);
          expect(readStream).toBeDefined();
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
          expect(mockS3Client.send.mock.calls[0][0]).toBeInstanceOf(
            GetObjectCommand
          );

          mockS3Client.send.mockClear();
          mockS3Client.send.mockResolvedValueOnce({});
          await driver.delete(mediaKey);
          expect(mockS3Client.send).toHaveBeenCalledTimes(1);
          expect(mockS3Client.send.mock.calls[0][0]).toBeInstanceOf(
            DeleteObjectCommand
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle keys without prefix when prefix is empty", async () => {
    const configWithoutPrefix: S3Config = {
      ...mockConfig,
      prefix: ""
    };

    driver = new S3StorageDriver(configWithoutPrefix);

    const mediaKey = "test/file.jpg";
    const buffer = Buffer.from("test data");

    mockS3Client.send.mockResolvedValueOnce({});

    await driver.write(mediaKey, buffer, "image/jpeg");

    expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    expect(mockS3Client.send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
  });

  it("should return signed URL", async () => {
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    getSignedUrl.mockResolvedValueOnce("https://signed-url.com");

    const url = await driver.getSignedUrl("test/file.jpg", 3600);

    expect(url).toBe("https://signed-url.com");
    expect(getSignedUrl).toHaveBeenCalledWith(
      mockS3Client,
      expect.any(GetObjectCommand),
      { expiresIn: 3600 }
    );
  });

  it("should return false when file does not exist", async () => {
    const error: any = new Error("Not Found");
    error.name = "NotFound";
    mockS3Client.send.mockRejectedValueOnce(error);

    const exists = await driver.exists("nonexistent/file.jpg");

    expect(exists).toBe(false);
  });

  it("should throw error for non-NotFound errors in exists", async () => {
    const error = new Error("Network error");
    mockS3Client.send.mockRejectedValueOnce(error);

    await expect(driver.exists("test/file.jpg")).rejects.toThrow(
      "Network error"
    );
  });

  it("should get file size from S3", async () => {
    const expectedSize = 1024;
    mockS3Client.send.mockResolvedValueOnce({
      ContentLength: expectedSize
    });

    const fileSize = await driver.getFileSize("test/file.jpg");

    expect(fileSize).toBe(expectedSize);
    expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    expect(mockS3Client.send.mock.calls[0][0]).toBeInstanceOf(
      HeadObjectCommand
    );
  });

  it("should return 0 when file size cannot be determined", async () => {
    const error: any = new Error("Not Found");
    error.name = "NotFound";
    mockS3Client.send.mockRejectedValueOnce(error);

    const fileSize = await driver.getFileSize("nonexistent/file.jpg");

    expect(fileSize).toBe(0);
  });

  it("should return 0 when ContentLength is undefined", async () => {
    mockS3Client.send.mockResolvedValueOnce({
      ContentLength: undefined
    });

    const fileSize = await driver.getFileSize("test/file.jpg");

    expect(fileSize).toBe(0);
  });
});
