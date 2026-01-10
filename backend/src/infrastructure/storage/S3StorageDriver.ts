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
  private client: S3Client;

  private bucket: string;

  private prefix: string;

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

    logger.info(
      {
        key,
        fullKey,
        bucket: this.bucket,
        mimetype,
        isBuffer: Buffer.isBuffer(data)
      },
      "[S3-DRIVER] Starting S3 write operation"
    );

    const body = Buffer.isBuffer(data)
      ? data
      : await S3StorageDriver.streamToBuffer(data);

    logger.info(
      {
        fullKey,
        bucket: this.bucket,
        size: body.length,
        mimetype
      },
      "[S3-DRIVER] Sending PutObjectCommand to S3"
    );

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fullKey,
      Body: body,
      ContentType: mimetype
    });

    try {
      const response = await this.client.send(command);

      logger.info(
        {
          fullKey,
          bucket: this.bucket,
          size: body.length,
          etag: response.ETag,
          versionId: response.VersionId
        },
        "[S3-DRIVER] S3 write operation completed successfully"
      );
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          errorCode: error.Code,
          errorName: error.name,
          errorStack: error.stack,
          fullKey,
          bucket: this.bucket,
          size: body.length
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
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          errorCode: error.Code,
          errorName: error.name,
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
    } catch (error: any) {
      if (error.name === "NotFound") {
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
    } catch (error: any) {
      logger.warn(
        {
          error: error.message,
          errorCode: error.Code,
          errorName: error.name,
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
