import { S3Config } from "../../domain/storage/StorageConfig";
import AppError from "../../errors/AppError";
import ValidateS3ConfigService from "./ValidateS3ConfigService";

interface TestStorageConnectionRequest {
  driver: "local" | "s3";
  s3Config?: S3Config;
}

interface TestStorageConnectionResponse {
  valid: boolean;
  message: string;
}

const TestStorageConnectionService = async ({
  driver,
  s3Config
}: TestStorageConnectionRequest): Promise<TestStorageConnectionResponse> => {
  if (driver === "local") {
    return {
      valid: true,
      message: "Local storage is always available"
    };
  }

  if (driver === "s3") {
    if (!s3Config) {
      throw new AppError("S3 configuration is required", 400);
    }

    const validationResult = await ValidateS3ConfigService({
      s3Config,
      dryRun: false
    });

    if (!validationResult.valid) {
      throw new AppError(validationResult.error || "S3 validation failed", 400);
    }

    return {
      valid: true,
      message: "S3 connection test successful (upload, read, delete)"
    };
  }

  throw new AppError("Invalid storage driver", 400);
};

export default TestStorageConnectionService;
