import { FileContents } from "@flystorage/file-storage";
import mime from "mime-types";
import { StorageDriverFactory } from "../infrastructure/storage/StorageDriverFactory";
import Ticket from "../models/Ticket";
import GetStorageConfigService from "../services/StorageServices/GetStorageConfigService";
import OptimizeImageService from "../services/StorageServices/OptimizeImageService";
import { logger } from "../utils/logger";
import { makeRandomId } from "./MakeRandomId";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    stream.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on("error", (error: Error) => {
      logger.error({ error: error.message }, "Error reading stream");
      reject(new Error(`Error reading stream: ${error.message}`));
    });
  });
}

async function convertToBuffer(data: FileContents): Promise<Buffer> {
  if (typeof data === "string") {
    return Buffer.from(data);
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  return streamToBuffer(data as NodeJS.ReadableStream);
}

export default async function saveMediaToFile(
  media: {
    data: FileContents;
    mimetype: string;
    filename: string;
  },
  destination: Ticket | number
): Promise<{ mediaPath: string; fileSize: number }> {
  if (!media || !media.data || !media.mimetype || !destination) {
    logger.error("saveMediaToFile: Invalid media or destination provided");
    throw new Error("Invalid media or destination provided");
  }

  if (!media.filename) {
    const rawMimetype = media.mimetype.split(";")[0];
    const ext = mime.extension(rawMimetype) || "bin";
    media.filename = `${new Date().getTime()}.${ext}`;
  }

  const randomId = makeRandomId(10);

  const companyId =
    typeof destination === "number" ? destination : destination.companyId;
  const contactId =
    typeof destination === "number" ? undefined : destination.contactId;
  const ticketId = typeof destination === "number" ? undefined : destination.id;

  let relativePath = `media/${companyId}/`;

  if (contactId && ticketId) {
    relativePath += `${contactId}/${ticketId}/`;
  }

  relativePath += `${randomId}`;

  const mediaPath = `${relativePath}/${media.filename}`;

  logger.info(
    {
      companyId,
      contactId,
      ticketId,
      mediaPath,
      mimetype: media.mimetype,
      filename: media.filename
    },
    "[MEDIA-STORAGE] Starting media file save operation"
  );
  let finalFileSize;
  try {
    logger.info(
      { companyId },
      "[MEDIA-STORAGE] Retrieving storage configuration"
    );
    const storageConfig = await GetStorageConfigService({ companyId });

    logger.info(
      {
        companyId,
        driver: storageConfig.driver,
        hasS3Config: !!storageConfig.s3Config,
        hasImageOptimization: !!storageConfig.imageOptimization,
        s3Endpoint: storageConfig.s3Config?.endpoint,
        s3Bucket: storageConfig.s3Config?.bucket,
        s3Region: storageConfig.s3Config?.region,
        s3Prefix: storageConfig.s3Config?.prefix
      },
      "[MEDIA-STORAGE] Storage configuration retrieved"
    );

    logger.info(
      { companyId, driver: storageConfig.driver },
      "[MEDIA-STORAGE] Creating storage driver"
    );
    const driver = await StorageDriverFactory.createDriver(storageConfig);

    const isStream =
      media.data &&
      typeof media.data === "object" &&
      "pipe" in media.data &&
      typeof media.data.pipe === "function";

    if (isStream && !storageConfig.imageOptimization) {
      logger.info(
        { companyId, mediaPath, driver: storageConfig.driver },
        "[MEDIA-STORAGE] Streaming file directly to storage (no buffer)"
      );

      await driver.write(
        mediaPath,
        media.data as NodeJS.ReadableStream,
        media.mimetype
      );

      logger.info(
        { companyId, mediaPath, driver: storageConfig.driver },
        "[MEDIA-STORAGE] Media file streamed successfully"
      );

      return { mediaPath, fileSize: 0 };
    }

    logger.info(
      { companyId, mimetype: media.mimetype },
      "[MEDIA-STORAGE] Converting media data to buffer"
    );
    let dataBuffer = await convertToBuffer(media.data);
    const originalSize = dataBuffer.length;
    const fileSize = originalSize;

    logger.info(
      { companyId, originalSize, fileSize },
      "[MEDIA-STORAGE] Media data converted to buffer"
    );

    if (storageConfig.imageOptimization) {
      logger.info(
        {
          companyId,
          mimetype: media.mimetype,
          originalSize,
          config: storageConfig.imageOptimization
        },
        "[MEDIA-STORAGE] Starting image optimization"
      );

      const optimizationResult = await OptimizeImageService({
        data: dataBuffer,
        mimetype: media.mimetype,
        config: storageConfig.imageOptimization
      });

      dataBuffer = optimizationResult.data;

      logger.info(
        {
          companyId,
          originalSize,
          optimizedSize: dataBuffer.length,
          reduction: originalSize - dataBuffer.length,
          finalFileSize: dataBuffer.length
        },
        "[MEDIA-STORAGE] Image optimization completed"
      );

      finalFileSize = dataBuffer.length;
    } else {
      finalFileSize = fileSize;
    }

    logger.info(
      {
        companyId,
        mediaPath,
        driver: storageConfig.driver,
        size: dataBuffer.length,
        mimetype: media.mimetype
      },
      "[MEDIA-STORAGE] Writing file to storage"
    );

    await driver.write(mediaPath, dataBuffer, media.mimetype);

    logger.info(
      {
        companyId,
        mediaPath,
        driver: storageConfig.driver,
        size: dataBuffer.length,
        fileSize: finalFileSize
      },
      "[MEDIA-STORAGE] Media file saved successfully"
    );
  } catch (error) {
    logger.error(
      {
        error: error.message,
        errorStack: error.stack,
        companyId,
        mediaPath,
        mimetype: media.mimetype
      },
      "[MEDIA-STORAGE] Failed to save media file"
    );
    throw new Error(`Failed to save media file: ${error.message}`);
  }

  return { mediaPath, fileSize: finalFileSize };
}
