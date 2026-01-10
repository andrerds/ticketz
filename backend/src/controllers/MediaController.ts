import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import mime from "mime-types";
import { getPublicPath } from "../helpers/GetPublicPath";
import GetStorageConfigService from "../services/StorageServices/GetStorageConfigService";
import { StorageDriverFactory } from "../infrastructure/storage/StorageDriverFactory";
import { logger } from "../utils/logger";

export const serve = async (req: Request, res: Response): Promise<void> => {
  const mediaKey = req.params[0];
  const localFilePath = path.join(getPublicPath(), mediaKey);

  try {
    await fs.promises.access(localFilePath, fs.constants.F_OK);

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
    try {
      const companyIdMatch = mediaKey.match(/^media\/(\d+)\//);
      if (!companyIdMatch) {
        logger.debug({ mediaKey }, "Invalid media key format");
        res.status(404).end();
        return;
      }

      const companyId = parseInt(companyIdMatch[1], 10);
      const config = await GetStorageConfigService({ companyId });

      if (config.driver !== "s3") {
        res.status(404).end();
        return;
      }

      const driver = await StorageDriverFactory.createDriver(config);
      const stream = await driver.read(mediaKey);

      const contentType = mime.lookup(mediaKey) || "application/octet-stream";
      res.setHeader("Content-Type", contentType);

      if (mediaKey.endsWith(".aac")) {
        res.setHeader("Content-Type", "audio/aac");
      }

      stream.pipe(res);

      stream.on("error", err => {
        logger.error({ err, mediaKey }, "Error streaming from S3");
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
    } catch (s3Error) {
      logger.debug({ s3Error, mediaKey }, "File not found in S3");
      res.status(404).end();
    }
  }
};
