import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { IStorageDriver } from "../../domain/storage/IStorageDriver";
import { S3Config } from "../../domain/storage/StorageConfig";
import { logger } from "../../utils/logger";

export class S3StorageDriver implements IStorageDriver {
  public readonly client: S3Client;

  public readonly bucket: string;

  public readonly prefix: string;

  constructor(config: S3Config) {
    logger.info(
      {
        endpoint: config.endpoint,
        region: config.region,
        bucket: config.bucket,
        accessKeyId: config.accessKeyId,
        forcePathStyle: config.forcePathStyle,
        prefix: config.prefix,
        hasSecretKey: !!config.secretAccessKey
      },
      "[S3-DRIVER] Initializing S3 storage driver"
    );

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

    logger.info(
      { bucket: this.bucket, prefix: this.prefix },
      "[S3-DRIVER] S3 storage driver initialized"
    );
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
    const isStream = !Buffer.isBuffer(data);

    logger.info(
      {
        key,
        fullKey,
        bucket: this.bucket,
        mimetype,
        isBuffer: !isStream,
        isStream
      },
      "[S3-DRIVER] Starting S3 write operation"
    );

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: isStream ? (data as Readable) : data,
      ContentType: mimetype
    });

    try {
      const response = await this.client.send(command);

      logger.info(
        {
          fullKey,
          bucket: this.bucket,
          etag: response.ETag,
          versionId: response.VersionId,
          streamMode: isStream
        },
        "[S3-DRIVER] S3 write operation completed successfully"
      );
    } catch (error: unknown) {
      const s3Error = error as {
        message: string;
        Code?: string;
        name: string;
        stack?: string;
      };
      logger.error(
        {
          error: s3Error.message,
          errorCode: s3Error.Code,
          errorName: s3Error.name,
          errorStack: s3Error.stack,
          fullKey,
          bucket: this.bucket,
          streamMode: isStream
        },
        "[S3-DRIVER] S3 write operation failed"
      );
      throw error;
    }
  }

  async read(key: string): Promise<NodeJS.ReadableStream> {
    const fullKey = this.getFullKey(key);

    logger.info(
      { key, fullKey, bucket: this.bucket },
      "[S3-DRIVER] Starting S3 read operation"
    );

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fullKey
    });

    try {
      const response = await this.client.send(command);

      logger.info(
        {
          fullKey,
          bucket: this.bucket,
          contentType: response.ContentType,
          contentLength: response.ContentLength
        },
        "[S3-DRIVER] S3 read operation completed successfully"
      );

      return response.Body as Readable;
    } catch (error: unknown) {
      const s3Error = error as { message: string; Code?: string; name: string };
      logger.error(
        {
          error: s3Error.message,
          errorCode: s3Error.Code,
          errorName: s3Error.name,
          fullKey,
          bucket: this.bucket
        },
        "[S3-DRIVER] S3 read operation failed"
      );
      throw error;
    }
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
    } catch (error: unknown) {
      const s3Error = error as { name: string };
      if (s3Error.name === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  async getFileSize(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);

    logger.info(
      { key, fullKey, bucket: this.bucket },
      "[S3-DRIVER] Getting file size from S3"
    );

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fullKey
      });

      const response = await this.client.send(command);
      const fileSize = response.ContentLength || 0;

      logger.info(
        { fullKey, bucket: this.bucket, fileSize },
        "[S3-DRIVER] File size retrieved successfully"
      );

      return fileSize;
    } catch (error: unknown) {
      const s3Error = error as { message: string; Code?: string; name: string };
      logger.warn(
        {
          error: s3Error.message,
          errorCode: s3Error.Code,
          errorName: s3Error.name,
          fullKey,
          bucket: this.bucket
        },
        "[S3-DRIVER] Failed to get file size from S3"
      );
      return 0;
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

  private static async streamToBuffer(
    stream: NodeJS.ReadableStream
  ): Promise<Buffer> {
    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }
    return Buffer.concat(chunks);
  }
}
