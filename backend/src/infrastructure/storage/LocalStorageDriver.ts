import { IStorageDriver } from "../../domain/storage/IStorageDriver";
import { FileStorage } from "@flystorage/file-storage";
import { LocalStorageAdapter } from "@flystorage/local-fs";
import { getPublicPath } from "../../helpers/GetPublicPath";
import fs from "fs";
import path from "path";

export class LocalStorageDriver implements IStorageDriver {
  private storage: FileStorage;

  constructor() {
    this.storage = new FileStorage(new LocalStorageAdapter(getPublicPath()));
  }

  async write(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    mimetype: string
  ): Promise<void> {
    await this.storage.write(key, data);
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
}
