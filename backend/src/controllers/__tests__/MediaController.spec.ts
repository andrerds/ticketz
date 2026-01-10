// eslint-disable-next-line import/no-extraneous-dependencies
import * as fc from "fast-check";
import { Request, Response } from "express";
import { serve } from "../MediaController";
import fs from "fs";
import path from "path";
import { getPublicPath } from "../../helpers/GetPublicPath";
import GetStorageConfigService from "../../services/StorageServices/GetStorageConfigService";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import { Readable } from "stream";

jest.mock("fs");
jest.mock("../../services/StorageServices/GetStorageConfigService");
jest.mock("../../infrastructure/storage/StorageDriverFactory");

describe("MediaController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSendFile: jest.Mock;
  let mockSetHeader: jest.Mock;
  let mockStatus: jest.Mock;
  let mockEnd: jest.Mock;

  beforeEach(() => {
    mockSendFile = jest.fn();
    mockSetHeader = jest.fn();
    mockStatus = jest.fn().mockReturnThis();
    mockEnd = jest.fn();

    mockRequest = {
      params: {}
    };

    mockResponse = {
      sendFile: mockSendFile,
      setHeader: mockSetHeader,
      status: mockStatus,
      end: mockEnd,
      headersSent: false
    };
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
          mockRequest.params = [mediaKey];

          (fs.promises.access as jest.Mock).mockResolvedValueOnce(undefined);

          await serve(mockRequest as Request, mockResponse as Response);

          expect(fs.promises.access).toHaveBeenCalledWith(
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
          mockRequest.params = [mediaKey];

          (fs.promises.access as jest.Mock).mockResolvedValueOnce(undefined);

          await serve(mockRequest as Request, mockResponse as Response);

          expect(mockSendFile).toHaveBeenCalled();
          expect(GetStorageConfigService).not.toHaveBeenCalled();
          expect(StorageDriverFactory.createDriver).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
