import { IStorageDriver } from "../../domain/storage/IStorageDriver";
import { S3Config } from "../../domain/storage/StorageConfig";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

export class S3StorageDriver implements IStorageDriver {
  private client: S3Client;

  private bucket: string;

  private prefix: string;

  constructor(config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      forcePathStyle: config.forcePathStyle
    });
    this.bucket = config.bucket;
    this.prefix = config.prefix || "";
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async write(
    key: string,
    data: Buffer | NodeJS.ReadableStream,
    mimetype: string
  ): Promise<void> {
    const fullKey = this.getFullKey(key);
    const body = Buffer.isBuffer(data) ? data : await this.streamToBuffer(data);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: body,
      ContentType: mimetype
    });

    await this.client.send(command);
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });

    const response = await this.client.send(command);
    return response.Body as Readable;
  }

  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey
      });
      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });
    await this.client.send(command);
  }

  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    const fullKey = this.getFullKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }
    return Buffer.concat(chunks);
  }
}
