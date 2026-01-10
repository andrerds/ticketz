import * as fc from "fast-check";
import ValidateS3ConfigService from "../ValidateS3ConfigService";
import { S3Config } from "../../../domain/storage/StorageConfig";

jest.mock("@aws-sdk/client-s3");

describe("ValidateS3ConfigService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: s3-media-storage, Property 2: S3 credential validation
   * For any S3 configuration, when saved, the system should validate credentials by testing connectivity before persisting
   * Validates: Requirements 1.2, 6.3
   */
  it("should validate S3 credentials before persisting", async () => {
    // eslint-disable-next-line global-require
    const { S3Client } = require("@aws-sdk/client-s3");

    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.constantFrom("us-east-1", "us-west-2", "eu-west-1"),
        fc.string({ minLength: 3, maxLength: 63 }),
        fc.string({ minLength: 16, maxLength: 128 }),
        fc.string({ minLength: 32, maxLength: 128 }),
        fc.boolean(),
        async (
          endpoint: string,
          region: string,
          bucket: string,
          accessKeyId: string,
          secretAccessKey: string,
          forcePathStyle: boolean
        ) => {
          const s3Config: S3Config = {
            endpoint,
            region,
            bucket,
            accessKeyId,
            secretAccessKey,
            forcePathStyle,
            prefix: undefined
          };

          S3Client.prototype.send = jest.fn().mockResolvedValue({});

          const result = await ValidateS3ConfigService({
            s3Config,
            dryRun: false
          });

          expect(result.valid).toBe(true);
          expect(S3Client.prototype.send).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should return error for invalid credentials", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");

    const s3Config: S3Config = {
      endpoint: "https://s3.amazonaws.com",
      region: "us-east-1",
      bucket: "test-bucket",
      accessKeyId: "invalid-key",
      secretAccessKey: "invalid-secret",
      forcePathStyle: false
    };

    const authError = new Error("Invalid credentials");
    (authError as any).name = "InvalidAccessKeyId";

    S3Client.prototype.send = jest.fn().mockRejectedValue(authError);

    const result = await ValidateS3ConfigService({
      s3Config,
      dryRun: false
    });

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("ERR_S3_AUTH_FAILED");
  });

  it("should return error for non-existent bucket", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");

    const s3Config: S3Config = {
      endpoint: "https://s3.amazonaws.com",
      region: "us-east-1",
      bucket: "non-existent-bucket",
      accessKeyId: "valid-key",
      secretAccessKey: "valid-secret",
      forcePathStyle: false
    };

    const bucketError = new Error("Bucket not found");
    (bucketError as any).name = "NoSuchBucket";

    S3Client.prototype.send = jest.fn().mockRejectedValue(bucketError);

    const result = await ValidateS3ConfigService({
      s3Config,
      dryRun: false
    });

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("ERR_S3_BUCKET_NOT_FOUND");
  });

  it("should return error for network failures", async () => {
    const { S3Client } = require("@aws-sdk/client-s3");

    const s3Config: S3Config = {
      endpoint: "https://s3.amazonaws.com",
      region: "us-east-1",
      bucket: "test-bucket",
      accessKeyId: "valid-key",
      secretAccessKey: "valid-secret",
      forcePathStyle: false
    };

    const networkError = new Error("Network error");
    (networkError as any).code = "ENOTFOUND";

    S3Client.prototype.send = jest.fn().mockRejectedValue(networkError);

    const result = await ValidateS3ConfigService({
      s3Config,
      dryRun: false
    });

    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe("ERR_S3_NETWORK_FAILED");
  });
});
