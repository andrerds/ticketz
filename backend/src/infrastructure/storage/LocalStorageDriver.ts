import { FileStorage } from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";
import fs from "fs";
import path from "path";
import { IStorageDriver } from "../../domain/storage/IStorageDriver";
import { getPublicPath } from "../../helpers/GetPublicPath";
import { logger } from "../../utils/logger";

export class LocalStorageDriver implements IStorageDriver {
  private storage: FileStorage;

  constructor() {
    const publicPath = getPublicPath();
    logger.info(
      { publicPath },
      "[LOCAL-DRIVER] Initializing local storage driver"
    );
    this.storage = new FileStorage(new LocalStorageAdapter(publicPath));
  }

  async write(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    mimetype: string
  ): Promise<void> {
    logger.info(
      { key, mimetype, isBuffer: Buffer.isBuffer(data) },
      "[LOCAL-DRIVER] Starting local write operation"
    );

    try {
      await this.storage.write(key, data);

      logger.info(
        { key, mimetype },
        "[LOCAL-DRIVER] Local write operation completed successfully"
      );
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          errorStack: error.stack,
          key,
          mimetype
        },
        "[LOCAL-DRIVER] Local write operation failed"
      );
      throw error;
    }
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    const fullPath = path.join(getPublicPath(), key);
    return fs.createReadStream(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(getPublicPath(), key);
    return fs.promises
      .access(fullPath, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(getPublicPath(), key);
    await fs.promises.unlink(fullPath);
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string | null> {
    return null;
  }

  async getFileSize(key: string): Promise<number> {
    const fullPath = path.join(getPublicPath(), key);

    logger.info(
      { key, fullPath },
      "[LOCAL-DRIVER] Getting file size from local storage"
    );

    try {
      const stats = await fs.promises.stat(fullPath);
      const fileSize = stats.size;

      logger.info(
        { key, fullPath, fileSize },
        "[LOCAL-DRIVER] File size retrieved successfully"
      );

      return fileSize;
    } catch (error: any) {
      logger.warn(
        {
          error: error.message,
          key,
          fullPath
        },
        "[LOCAL-DRIVER] Failed to get file size from local storage"
      );
      return 0;
    }
  }
}
