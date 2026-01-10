export type StorageDriver = "local" | "s3";

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  prefix?: string;
}

export interface ImageOptimizationConfig {
  enabled: boolean;
  maxWidth: number;
  quality: number;
  maxBytes: number;
}

export class StorageConfig {
  constructor(
    public readonly companyId: number,
    public readonly driver: StorageDriver,
    public readonly s3Config?: S3Config,
    public readonly imageOptimization?: ImageOptimizationConfig
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.driver === "s3" && !this.s3Config) {
      throw new Error("S3 configuration required when driver is s3");
    }

    if (this.s3Config) {
      const required = [
        "endpoint",
        "region",
        "bucket",
        "accessKeyId",
        "secretAccessKey"
      ];
      required.forEach(field => {
        if (!this.s3Config![field as keyof S3Config]) {
          throw new Error(`S3 configuration missing required field: ${field}`);
        }
      });
    }
  }

  public maskSecrets(): StorageConfig {
    if (!this.s3Config) return this;

    return new StorageConfig(
      this.companyId,
      this.driver,
      {
        ...this.s3Config,
        secretAccessKey: "*****"
      },
      this.imageOptimization
    );
  }
}
