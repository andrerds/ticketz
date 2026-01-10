// eslint-disable-next-line import/no-extraneous-dependencies
import * as fc from "fast-check";
import { Request, Response } from "express";
import { Readable } from "stream";

const mockAccess = jest.fn();
const mockSendFile = jest.fn();

jest.mock("fs", () => ({
  promises: {
    access: mockAccess
  },
  constants: {
    F_OK: 0
  }
}));

jest.mock("../../services/StorageServices/GetStorageConfigService");
jest.mock("../../infrastructure/storage/StorageDriverFactory");

import { serve } from "../MediaController";
import fs from "fs";
import path from "path";
import { getPublicPath } from "../../helpers/GetPublicPath";
import GetStorageConfigService from "../../services/StorageServices/GetStorageConfigService";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";

describe("MediaController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSetHeader: jest.Mock;
  let mockStatus: jest.Mock;
  let mockEnd: jest.Mock;

  beforeEach(() => {
    mockSendFile.mockClear();
    mockAccess.mockClear();
    mockSetHeader = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockEnd = jest.fn();

    mockRequest = {
      params: {} as any
    };

    mockResponse = {
      sendFile: mockSendFile,
      setHeader: mockSetHeader,
      status: mockStatus,
      end: mockEnd,
      headersSent: false
    } as any;

    (GetStorageConfigService as jest.Mock).mockClear();
    (StorageDriverFactory.createDriver as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: s3-media-storage, Property 11: Local filesystem priority
   * For any media file request, the system should check local filesystem before attempting S3 retrieval
   * Validates: Requirements 3.2
   */
  it("should check local filesystem before attempting S3 retrieval", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        async (companyId, contactId, ticketId, filename) => {
          const mediaKey = `media/${companyId}/${contactId}/${ticketId}/${filename}`;
          (mockRequest as any).params = [mediaKey];

          mockAccess.mockResolvedValueOnce(undefined);

          await serve(mockRequest as Request, mockResponse as Response);

          expect(mockAccess).toHaveBeenCalledWith(
            path.join(getPublicPath(), mediaKey),
            fs.constants.F_OK
          );
          expect(mockSendFile).toHaveBeenCalled();
          expect(GetStorageConfigService).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 16: Local precedence in hybrid mode
   * For any media file that exists in both local and S3 storage, the system should serve the local version
   * Validates: Requirements 4.3
   */
  it("should serve local file even when S3 is configured", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        async (companyId, filename) => {
          const mediaKey = `media/${companyId}/1/1/${filename}`;
          (mockRequest as any).params = [mediaKey];

          mockAccess.mockResolvedValueOnce(undefined);

          await serve(mockRequest as Request, mockResponse as Response);

          expect(mockSendFile).toHaveBeenCalled();
          expect(GetStorageConfigService).not.toHaveBeenCalled();
          expect(StorageDriverFactory.createDriver).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 12: S3 fallback retrieval
   * For any media file that doesn't exist locally, if S3 is configured, the system should attempt to retrieve it from S3
   * Validates: Requirements 3.3
   */
  it("should fallback to S3 when file not found locally", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        async (companyId, filename) => {
          const mediaKey = `media/${companyId}/1/1/${filename}`;
          (mockRequest as any).params = [mediaKey];

          mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

          const mockStream = new Readable();
          mockStream.push("test data");
          mockStream.push(null);

          const mockDriver = {
            read: jest.fn().mockResolvedValue(mockStream)
          };

          const mockConfig = {
            companyId,
            driver: "s3" as const,
            s3Config: {
              endpoint: "https://s3.amazonaws.com",
              region: "us-east-1",
              bucket: "test-bucket",
              accessKeyId: "test-key",
              secretAccessKey: "test-secret",
              forcePathStyle: false
            }
          };

          (GetStorageConfigService as jest.Mock).mockResolvedValueOnce(
            mockConfig
          );
          (
            StorageDriverFactory.createDriver as jest.Mock
          ).mockResolvedValueOnce(mockDriver);

          const mockPipe = jest.fn();
          mockStream.pipe = mockPipe;

          await serve(mockRequest as Request, mockResponse as Response);

          expect(mockAccess).toHaveBeenCalled();
          expect(GetStorageConfigService).toHaveBeenCalledWith({ companyId });
          expect(StorageDriverFactory.createDriver).toHaveBeenCalledWith(
            mockConfig
          );
          expect(mockDriver.read).toHaveBeenCalledWith(mediaKey);
          expect(mockPipe).toHaveBeenCalledWith(mockResponse);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 14: Backward compatibility
   * For any existing local media file, after enabling S3 storage, the file should remain accessible through the same URL
   * Validates: Requirements 4.1
   */
  it("should maintain backward compatibility for existing local files after S3 enablement", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 5, maxLength: 20 }),
        async (companyId, filename) => {
          const mediaKey = `media/${companyId}/1/1/${filename}`;
          (mockRequest as any).params = [mediaKey];

          mockAccess.mockResolvedValueOnce(undefined);

          const mockConfig = {
            companyId,
            driver: "s3" as const,
            s3Config: {
              endpoint: "https://s3.amazonaws.com",
              region: "us-east-1",
              bucket: "test-bucket",
              accessKeyId: "test-key",
              secretAccessKey: "test-secret",
              forcePathStyle: false
            }
          };

          await serve(mockRequest as Request, mockResponse as Response);

          expect(mockAccess).toHaveBeenCalled();
          expect(mockSendFile).toHaveBeenCalled();
          expect(GetStorageConfigService).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: s3-media-storage, Property 13: Content-Type headers
   * For any file streamed from S3, the response should include the appropriate Content-Type header based on the file's mimetype
   * Validates: Requirements 3.4
   */
  it("should set appropriate Content-Type headers for S3 files", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }),
        fc.constantFrom(
          { ext: "jpg", type: "image/jpeg" },
          { ext: "png", type: "image/png" },
          { ext: "pdf", type: "application/pdf" },
          { ext: "mp4", type: "video/mp4" },
          { ext: "mp3", type: "audio/mpeg" },
          { ext: "aac", type: "audio/aac" }
        ),
        async (companyId, fileInfo) => {
          const filename = `test.${fileInfo.ext}`;
          const mediaKey = `media/${companyId}/1/1/${filename}`;
          (mockRequest as any).params = [mediaKey];

          mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

          const mockStream = new Readable();
          mockStream.push("test data");
          mockStream.push(null);

          const mockDriver = {
            read: jest.fn().mockResolvedValue(mockStream)
          };

          const mockConfig = {
            companyId,
            driver: "s3" as const,
            s3Config: {
              endpoint: "https://s3.amazonaws.com",
              region: "us-east-1",
              bucket: "test-bucket",
              accessKeyId: "test-key",
              secretAccessKey: "test-secret",
              forcePathStyle: false
            }
          };

          (GetStorageConfigService as jest.Mock).mockResolvedValueOnce(
            mockConfig
          );
          (
            StorageDriverFactory.createDriver as jest.Mock
          ).mockResolvedValueOnce(mockDriver);

          const mockPipe = jest.fn();
          mockStream.pipe = mockPipe;

          await serve(mockRequest as Request, mockResponse as Response);

          expect(mockSetHeader).toHaveBeenCalledWith(
            "Content-Type",
            fileInfo.type
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
