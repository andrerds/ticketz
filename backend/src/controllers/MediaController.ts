import { Request, Response } from "express";
import fs from "fs";
import mime from "mime-types";
import path from "path";
import { generateS3DirectUrl } from "../helpers/generateS3DirectUrl";
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

  if (!companyId) {
    logger.debug({ mediaKey }, "Invalid media key format, no company ID found");
    res.status(404).end();
    return;
  }

  try {
    const config = await GetStorageConfigService({ companyId });

    logger.info(
      { companyId, mediaKey, driver: config.driver },
      "[MEDIA-CONTROLLER] Storage driver configuration retrieved"
    );

    // NEW LOGIC: If S3 is active, S3 becomes PRIORITY
    if (config.driver === "s3") {
      logger.info(
        { companyId, mediaKey },
        "[MEDIA-CONTROLLER] S3 is active - trying S3 first (priority)"
      );

      // Try S3 first (priority when S3 is active)
      try {
        const driver = await StorageDriverFactory.createDriver(config);
        const stream = await driver.read(mediaKey);

        const contentType = mime.lookup(mediaKey) || "application/octet-stream";
        res.setHeader("Content-Type", contentType);

        if (mediaKey.endsWith(".aac")) {
          res.setHeader("Content-Type", "audio/aac");
        }

        logger.info(
          { companyId, mediaKey, contentType },
          "[MEDIA-CONTROLLER] Successfully serving from S3 (priority)"
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
        logger.info(
          { s3Error: s3Error.message, mediaKey, companyId },
          "[MEDIA-CONTROLLER] File not found in S3, trying local fallback"
        );

        // S3 failed, try local as fallback
        try {
          await fs.promises.access(localFilePath, fs.constants.F_OK);

          logger.info(
            { mediaKey, companyId },
            "[MEDIA-CONTROLLER] File found locally (fallback from S3)"
          );

          const contentType =
            mime.lookup(mediaKey) || "application/octet-stream";
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
          logger.error(
            {
              s3Error: s3Error.message,
              localError: localError.message,
              mediaKey,
              companyId
            },
            "[MEDIA-CONTROLLER] File not found in S3 or local, returning 404"
          );
          res.status(404).end();
        }
      }
    } else {
      // S3 is NOT active - only try local, but check for legacy S3 files
      logger.info(
        { companyId, mediaKey },
        "[MEDIA-CONTROLLER] S3 is not active - trying local first"
      );

      try {
        await fs.promises.access(localFilePath, fs.constants.F_OK);

        logger.info(
          { mediaKey, companyId },
          "[MEDIA-CONTROLLER] File found locally"
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
        // File not found locally - check if it might be a legacy S3 file
        if (config.s3History?.hasS3History && config.s3History.legacyS3Config) {
          logger.info(
            {
              mediaKey,
              companyId,
              hasS3History: config.s3History.hasS3History,
              s3DeactivatedAt: config.s3History.s3DeactivatedAt
            },
            "[MEDIA-CONTROLLER] File not found locally, but S3 history exists - generating direct S3 URL"
          );

          try {
            // Generate direct S3 URL for legacy file
            const directS3Url = generateS3DirectUrl(
              config.s3History.legacyS3Config,
              mediaKey
            );

            logger.info(
              {
                mediaKey,
                companyId,
                directUrlPreview: `${directS3Url.substring(0, 100)}...`
              },
              "[MEDIA-CONTROLLER] Redirecting to direct S3 URL for legacy file"
            );

            // Redirect to direct S3 URL
            res.redirect(302, directS3Url);
            return;
          } catch (s3UrlError) {
            logger.error(
              {
                s3UrlError: s3UrlError.message,
                mediaKey,
                companyId
              },
              "[MEDIA-CONTROLLER] Failed to generate direct S3 URL for legacy file"
            );
          }
        }

        logger.error(
          {
            localError: localError.message,
            mediaKey,
            companyId,
            hasS3History: config.s3History?.hasS3History || false
          },
          "[MEDIA-CONTROLLER] File not found locally and no S3 history available, returning 404"
        );
        res.status(404).end();
      }
    }
  } catch (configError) {
    logger.error(
      { configError: configError.message, mediaKey, companyId },
      "[MEDIA-CONTROLLER] Error getting storage configuration"
    );
    res.status(500).end();
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
