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

  try {
    await fs.promises.access(localFilePath, fs.constants.F_OK);

    logger.info(
      { mediaKey },
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
  } catch (localError) {
    logger.info(
      { mediaKey },
      "[MEDIA-CONTROLLER] File not found locally, checking S3"
    );

    try {
      const companyIdMatch = mediaKey.match(/^media\/(\d+)\//);
      if (!companyIdMatch) {
        logger.debug({ mediaKey }, "Invalid media key format");
        res.status(404).end();
        return;
      }

      const companyId = parseInt(companyIdMatch[1], 10);

      logger.info(
        { companyId, mediaKey },
        "[MEDIA-CONTROLLER] Getting storage config for company"
      );

      const config = await GetStorageConfigService({ companyId });

      logger.info(
        { companyId, driver: config.driver, mediaKey },
        "[MEDIA-CONTROLLER] Storage config retrieved"
      );

      if (config.driver !== "s3") {
        logger.info(
          { companyId, driver: config.driver, mediaKey },
          "[MEDIA-CONTROLLER] Driver is not S3, returning 404"
        );
        res.status(404).end();
        return;
      }

      logger.info(
        { companyId, mediaKey },
        "[MEDIA-CONTROLLER] Creating S3 driver and reading file"
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
        "[MEDIA-CONTROLLER] Streaming file from S3"
      );

      stream.pipe(res);

      stream.on("error", err => {
        logger.error(
          { err, mediaKey },
          "[MEDIA-CONTROLLER] Error streaming from S3"
        );
        if (!res.headersSent) {
          res.status(500).end();
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
        { s3Error: s3Error.message, mediaKey },
        "[MEDIA-CONTROLLER] Error accessing file from S3"
      );
      res.status(404).end();
    }
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
  } catch (error: any) {
    logger.error(
      {
        error: error.message,
        errorStack: error.stack,
        companyId: req.user?.companyId
      },
      "[MEDIA-CONTROLLER] Error in S3 debug endpoint"
    );

    res.status(500).json({
      error: error.message || "Failed to retrieve S3 debug information"
    });
  }
};
