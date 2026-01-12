import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppError from "../../errors/AppError";
import { S3StorageDriver } from "../../infrastructure/storage/S3StorageDriver";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "./GetStorageConfigService";

export const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

export interface StartUploadRequest {
  filename: string;
  contentType: string;
  companyId: number;
  fileSize: number;
}

export interface StartUploadResponse {
  uploadId: string;
  key: string;
  totalParts: number;
  chunkSize: number;
}

export interface UploadPart {
  ETag: string;
  PartNumber: number;
}

export class MultipartUploadService {
  async startUpload(request: StartUploadRequest): Promise<StartUploadResponse> {
    const { companyId, filename, contentType, fileSize } = request;

    logger.info(
      { companyId, filename, fileSize },
      "[MULTIPART] Starting upload"
    );

    const config = await GetStorageConfigService({ companyId });

    if (config.driver !== "s3") {
      throw new AppError("Multipart upload only supported for S3 storage", 400);
    }

    const driver = (await StorageDriverFactory.createDriver(
      config
    )) as S3StorageDriver;
    const { client: s3Client, bucket, prefix } = driver;

    const mediaKey = `media/${companyId}/${Date.now()}_${filename}`;
    const fullKey = prefix ? `${prefix}/${mediaKey}` : mediaKey;

    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: fullKey,
      ContentType: contentType
    });

    const response = await s3Client.send(command);
    const totalParts = Math.ceil(fileSize / CHUNK_SIZE);

    logger.info(
      { uploadId: response.UploadId, key: mediaKey, totalParts },
      "[MULTIPART] Upload initiated"
    );

    return {
      uploadId: response.UploadId!,
      key: mediaKey,
      totalParts,
      chunkSize: CHUNK_SIZE
    };
  }

  async getSignedUrl(
    uploadId: string,
    key: string,
    partNumber: number,
    companyId: number
  ): Promise<string> {
    logger.debug(
      { uploadId, key, partNumber, companyId },
      "[MULTIPART] Generating signed URL"
    );

    const config = await GetStorageConfigService({ companyId });

    if (config.driver !== "s3") {
      throw new AppError("Multipart upload only supported for S3 storage", 400);
    }

    const driver = (await StorageDriverFactory.createDriver(
      config
    )) as S3StorageDriver;
    const { client: s3Client, bucket, prefix } = driver;

    const fullKey = prefix ? `${prefix}/${key}` : key;

    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: fullKey,
      PartNumber: partNumber,
      UploadId: uploadId
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600
    });

    logger.debug(
      { partNumber, expiresIn: 3600 },
      "[MULTIPART] Signed URL generated"
    );

    return signedUrl;
  }

  async completeUpload(
    uploadId: string,
    key: string,
    parts: UploadPart[],
    companyId: number
  ): Promise<string> {
    logger.info(
      { uploadId, key, partsCount: parts.length },
      "[MULTIPART] Completing upload"
    );

    const config = await GetStorageConfigService({ companyId });

    if (config.driver !== "s3") {
      throw new AppError("Multipart upload only supported for S3 storage", 400);
    }

    const driver = (await StorageDriverFactory.createDriver(
      config
    )) as S3StorageDriver;
    const { client: s3Client, bucket, prefix } = driver;

    const fullKey = prefix ? `${prefix}/${key}` : key;

    const sortedParts = parts
      .sort((a, b) => a.PartNumber - b.PartNumber)
      .map(p => ({
        ETag: p.ETag.replace(/"/g, ""),
        PartNumber: p.PartNumber
      }));

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: fullKey,
      UploadId: uploadId,
      MultipartUpload: { Parts: sortedParts }
    });

    const response = await s3Client.send(command);

    logger.info(
      { uploadId, location: response.Location },
      "[MULTIPART] Upload completed successfully"
    );

    return response.Location || key;
  }

  async abortUpload(
    uploadId: string,
    key: string,
    companyId: number
  ): Promise<void> {
    logger.warn({ uploadId, key }, "[MULTIPART] Aborting upload");

    const config = await GetStorageConfigService({ companyId });

    if (config.driver !== "s3") {
      throw new AppError("Multipart upload only supported for S3 storage", 400);
    }

    const driver = (await StorageDriverFactory.createDriver(
      config
    )) as S3StorageDriver;
    const { client: s3Client, bucket, prefix } = driver;

    const fullKey = prefix ? `${prefix}/${key}` : key;

    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: fullKey,
      UploadId: uploadId
    });

    await s3Client.send(command);

    logger.info({ uploadId }, "[MULTIPART] Upload aborted");
  }
}
