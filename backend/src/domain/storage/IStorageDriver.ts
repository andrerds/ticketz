export interface IStorageDriver {
  write(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    mimetype: string
  ): Promise<void>;
  read(key: string): Promise<NodeJS.ReadableStream>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string | null>;
}
