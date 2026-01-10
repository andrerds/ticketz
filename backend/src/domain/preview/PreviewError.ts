import AppError from "../../errors/AppError";

export enum PreviewErrorCode {
  STORAGE_DETECTION_FAILED = "STORAGE_DETECTION_FAILED",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  INVALID_MEDIA_KEY = "INVALID_MEDIA_KEY",
  THUMBNAIL_GENERATION_FAILED = "THUMBNAIL_GENERATION_FAILED",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  URL_GENERATION_FAILED = "URL_GENERATION_FAILED",
  INVALID_URL_FORMAT = "INVALID_URL_FORMAT",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  ACCESS_DENIED = "ACCESS_DENIED",
  CACHE_ERROR = "CACHE_ERROR",
  STREAMING_ERROR = "STREAMING_ERROR",
  STORAGE_CONFIG_ERROR = "STORAGE_CONFIG_ERROR",
  INVALID_STORAGE_LOCATION = "INVALID_STORAGE_LOCATION",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

export class PreviewError extends AppError {
  public readonly code: PreviewErrorCode;
  public readonly mediaKey?: string;
  public readonly companyId?: number;

  constructor(
    code: PreviewErrorCode,
    message: string,
    statusCode = 400,
    level = "warn",
    mediaKey?: string,
    companyId?: number
  ) {
    super(message, statusCode, level);
    this.code = code;
    this.mediaKey = mediaKey;
    this.companyId = companyId;
  }

  static storageDetectionFailed(
    mediaKey: string,
    companyId: number
  ): PreviewError {
    return new PreviewError(
      PreviewErrorCode.STORAGE_DETECTION_FAILED,
      "Failed to detect storage location for media file",
      500,
      "error",
      mediaKey,
      companyId
    );
  }

  static fileNotFound(mediaKey: string): PreviewError {
    return new PreviewError(
      PreviewErrorCode.FILE_NOT_FOUND,
      "Media file not found in any storage location",
      404,
      "warn",
      mediaKey
    );
  }

  static invalidMediaKey(mediaKey: string): PreviewError {
    return new PreviewError(
      PreviewErrorCode.INVALID_MEDIA_KEY,
      "Invalid media key format",
      400,
      "warn",
      mediaKey
    );
  }

  static thumbnailGenerationFailed(
    mediaKey: string,
    reason?: string
  ): PreviewError {
    const message = reason
      ? `Thumbnail generation failed: ${reason}`
      : "Thumbnail generation failed";

    return new PreviewError(
      PreviewErrorCode.THUMBNAIL_GENERATION_FAILED,
      message,
      500,
      "error",
      mediaKey
    );
  }

  static unsupportedFormat(mediaKey: string, format: string): PreviewError {
    return new PreviewError(
      PreviewErrorCode.UNSUPPORTED_FORMAT,
      `Unsupported file format: ${format}`,
      400,
      "warn",
      mediaKey
    );
  }

  static urlGenerationFailed(
    mediaKey: string,
    companyId?: number
  ): PreviewError {
    return new PreviewError(
      PreviewErrorCode.URL_GENERATION_FAILED,
      "Failed to generate preview URL",
      500,
      "error",
      mediaKey,
      companyId
    );
  }

  static invalidURLFormat(url: string): PreviewError {
    return new PreviewError(
      PreviewErrorCode.INVALID_URL_FORMAT,
      "Generated URL has invalid format",
      500,
      "error"
    );
  }

  static permissionDenied(mediaKey: string, companyId: number): PreviewError {
    return new PreviewError(
      PreviewErrorCode.PERMISSION_DENIED,
      "Access denied to media file",
      403,
      "warn",
      mediaKey,
      companyId
    );
  }
}
