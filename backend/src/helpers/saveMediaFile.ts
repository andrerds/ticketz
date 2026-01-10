import { FileContents } from "@flystorage/file-storage";
import mime from "mime-types";
import { logger } from "../utils/logger";
import { makeRandomId } from "./MakeRandomId";
import Ticket from "../models/Ticket";
import GetStorageConfigService from "../services/StorageServices/GetStorageConfigService";
import { StorageDriverFactory } from "../infrastructure/storage/StorageDriverFactory";

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
): Promise<string> {
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

  try {
    const storageConfig = await GetStorageConfigService({ companyId });
    const driver = await StorageDriverFactory.createDriver(storageConfig);

    const dataBuffer = await convertToBuffer(media.data);

    await driver.write(mediaPath, dataBuffer, media.mimetype);

    logger.info(
      { companyId, mediaPath, driver: storageConfig.driver },
      "Media file saved successfully"
    );
  } catch (error) {
    logger.error(
      { error: error.message, companyId, mediaPath },
      "Failed to save media file"
    );
    throw new Error(`Failed to save media file: ${error.message}`);
  }

  return mediaPath;
}
