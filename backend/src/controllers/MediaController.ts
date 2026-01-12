import { Request, Response } from "express";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { getPublicPath } from "../helpers/GetPublicPath";
import { StorageDriverFactory } from "../infrastructure/storage/StorageDriverFactory";
import { DebugS3Service } from "../services/MediaServices/DebugS3Service";
import GetStorageConfigService from "../services/StorageServices/GetStorageConfigService";
import { logger } from "../utils/logger";

export const serve = async (req: Request, res: Response): Promise<void> => {
  const mediaKey = req.params[0];
  const localFilePath = path.join(getPublicPath(), mediaKey);

  logger.info(
    { mediaKey, localFilePath },
    "[MEDIA-CONTROLLER] Serving media file request"
  );

  // Extract company ID from media key
  const companyIdMatch = mediaKey.match(/^media\/(\d+)\//);
  const companyId = companyIdMatch ? parseInt(companyIdMatch[1], 10) : null;

  // REQUIREMENT 3.2: Always serve local files regardless of storage driver configuration
  try {
    await fs.promises.access(localFilePath, fs.constants.F_OK);

    logger.info(
      { mediaKey, companyId },
      "[MEDIA-CONTROLLER] File found locally, serving from filesystem"
    );

    const contentType = mime.lookup(mediaKey) || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    if (mediaKey.endsWith(".aac")) {
      res.setHeader("Content-Type", "audio/aac");
    }

    res.sendFile(localFilePath, err => {
      if (err) {
        logger.error({ err, mediaKey }, "Error sending local file");
        if (!res.headersSent) {
          res.status(500).end();
        }
      }
    });
    return;
  } catch (localError) {
    logger.info(
      { mediaKey, companyId },
      "[MEDIA-CONTROLLER] File not found locally, checking storage configuration"
    );
  }

  // REQUIREMENT 3.1 & 3.4: Always try S3 as fallback to preserve user access to existing files
  if (!companyId) {
    logger.debug({ mediaKey }, "Invalid media key format, no company ID found");
    res.status(404).end();
    return;
  }

  try {
    const config = await GetStorageConfigService({ companyId });

    logger.info(
      { companyId, mediaKey, driver: config.driver },
      "[MEDIA-CONTROLLER] Attempting to serve from S3 as fallback"
    );

    const driver = await StorageDriverFactory.createDriver(config);
    const stream = await driver.read(mediaKey);

    const contentType = mime.lookup(mediaKey) || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    if (mediaKey.endsWith(".aac")) {
      res.setHeader("Content-Type", "audio/aac");
    }

    logger.info(
      { companyId, mediaKey, contentType },
      "[MEDIA-CONTROLLER] Successfully serving from S3 fallback"
    );

    stream.pipe(res);

    stream.on("error", err => {
      logger.error(
        { err, mediaKey },
        "[MEDIA-CONTROLLER] Error streaming from S3"
      );
      if (!res.headersSent) {
        res.status(404).end();
      }
    });

    stream.on("end", () => {
      logger.info(
        { companyId, mediaKey },
        "[MEDIA-CONTROLLER] Successfully streamed file from S3"
      );
    });
  } catch (s3Error) {
    logger.error(
      { s3Error: s3Error.message, mediaKey, companyId },
      "[MEDIA-CONTROLLER] File not found in S3 either, returning 404"
    );
    res.status(404).end();
  }
};

export const debugS3 = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only allow in development environment
    if (
      process.env.NODE_ENV !== "development" &&
      process.env.NODE_ENV !== "dev"
    ) {
      logger.warn(
        { nodeEnv: process.env.NODE_ENV },
        "[MEDIA-CONTROLLER] S3 debug endpoint accessed in non-development environment"
      );
      res.status(403).json({
        error: "S3 debug endpoint is only available in development environment"
      });
      return;
    }

    const { companyId } = req.user;

    logger.info({ companyId }, "[MEDIA-CONTROLLER] S3 debug endpoint accessed");

    const debugInfo = await DebugS3Service(companyId);

    logger.info(
      {
        companyId,
        totalFiles: debugInfo.totalFiles,
        totalSize: debugInfo.totalSize
      },
      "[MEDIA-CONTROLLER] S3 debug info retrieved successfully"
    );

    res.json(debugInfo);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(
      {
        error: errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        companyId: req.user?.companyId
      },
      "[MEDIA-CONTROLLER] Error in S3 debug endpoint"
    );

    res.status(500).json({
      error: errorMessage || "Failed to retrieve S3 debug information"
    });
  }
};
