import { S3Config } from "../../domain/storage/StorageConfig";
import { generateS3DirectUrl } from "../generateS3DirectUrl";

describe("generateS3DirectUrl", () => {
  const mockS3Config: S3Config = {
    endpoint: "https://hel1.your-objectstorage.com",
    region: "us-east-1",
    bucket: "ticketz-local",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: false,
    prefix: "media-prefix"
  };

  it("should generate correct S3 direct URL with prefix", () => {
    const mediaPath = "media/1/123/456/test-file.jpg";
    const result = generateS3DirectUrl(mockS3Config, mediaPath);

    expect(result).toBe(
      "https://hel1.your-objectstorage.com/ticketz-local/media-prefix/media/1/123/456/test-file.jpg"
    );
  });

  it("should generate correct S3 direct URL without prefix", () => {
    const configWithoutPrefix = { ...mockS3Config, prefix: undefined };
    const mediaPath = "media/1/123/456/test-file.jpg";
    const result = generateS3DirectUrl(configWithoutPrefix, mediaPath);

    expect(result).toBe(
      "https://hel1.your-objectstorage.com/ticketz-local/media/1/123/456/test-file.jpg"
    );
  });

  it("should handle endpoint with protocol", () => {
    const configWithProtocol = {
      ...mockS3Config,
      endpoint: "https://hel1.your-objectstorage.com"
    };
    const mediaPath = "media/1/123/456/test-file.jpg";
    const result = generateS3DirectUrl(configWithProtocol, mediaPath);

    expect(result).toBe(
      "https://hel1.your-objectstorage.com/ticketz-local/media-prefix/media/1/123/456/test-file.jpg"
    );
  });

  it("should handle endpoint without protocol", () => {
    const configWithoutProtocol = {
      ...mockS3Config,
      endpoint: "hel1.your-objectstorage.com"
    };
    const mediaPath = "media/1/123/456/test-file.jpg";
    const result = generateS3DirectUrl(configWithoutProtocol, mediaPath);

    expect(result).toBe(
      "https://hel1.your-objectstorage.com/ticketz-local/media-prefix/media/1/123/456/test-file.jpg"
    );
  });
});
