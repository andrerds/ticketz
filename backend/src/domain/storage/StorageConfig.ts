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

export interface MaskedS3Config extends Omit<S3Config, "secretAccessKey"> {
  secretAccessKey: string; // Will contain masked value
  hasPersistedCredentials: boolean; // New field
}

export interface ImageOptimizationConfig {
  enabled: boolean;
  maxWidth: number;
  quality: number;
  maxBytes: number;
}

export interface S3HistoryConfig {
  hasS3History: boolean;
  s3DeactivatedAt?: Date;
  legacyS3Config?: S3Config;
}

export class StorageConfig {
  constructor(
    public readonly companyId: number,
    public readonly driver: StorageDriver,
    public readonly s3Config?: S3Config,
    public readonly imageOptimization?: ImageOptimizationConfig,
    public readonly s3History?: S3HistoryConfig
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

  public maskSecrets(): {
    driver: StorageDriver;
    s3Config?: MaskedS3Config;
    imageOptimization?: ImageOptimizationConfig;
    s3History?: S3HistoryConfig;
  } {
    if (!this.s3Config) {
      return {
        driver: this.driver,
        imageOptimization: this.imageOptimization,
        s3History: this.s3History
      };
    }

    return {
      driver: this.driver,
      s3Config: {
        ...this.s3Config,
        secretAccessKey: "*****",
        hasPersistedCredentials: true
      },
      imageOptimization: this.imageOptimization,
      s3History: this.s3History
    };
  }
}
