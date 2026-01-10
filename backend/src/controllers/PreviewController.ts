import { Request, Response } from "express";
import { PreviewError, PreviewErrorCode, PreviewSize } from "../domain/preview";
import { PreviewURLGeneratorService } from "../services/PreviewServices/PreviewURLGeneratorService";
import { StorageDetectionService } from "../services/PreviewServices/StorageDetectionService";
import { ThumbnailHandlerService } from "../services/PreviewServices/ThumbnailHandlerService";
import { logger } from "../utils/logger";

export class PreviewController {
  private storageDetectionService: StorageDetectionService;

  private previewURLGeneratorService: PreviewURLGeneratorService;

  private thumbnailHandlerService: ThumbnailHandlerService;

  constructor() {
    this.storageDetectionService = new StorageDetectionService();
    this.previewURLGeneratorService = new PreviewURLGeneratorService();
    this.thumbnailHandlerService = new ThumbnailHandlerService();
  }

  private validatePreviewRequest(req: Request): void {
    const { mediaKey } = req.params;
    const { size, quality } = req.query;

    if (!mediaKey || typeof mediaKey !== "string" || mediaKey.trim() === "") {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Media key is required and must be a non-empty string",
        400,
        "warn"
      );
    }

    if (!/^[a-zA-Z0-9._/-]+$/.test(mediaKey)) {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Media key contains invalid characters",
        400,
        "warn"
      );
    }

    if (size && !["thumbnail", "medium", "full"].includes(size as string)) {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Invalid preview size",
        400,
        "warn"
      );
    }

    if (quality) {
      const qualityNum = parseInt(quality as string, 10);
      if (Number.isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
        throw new PreviewError(
          PreviewErrorCode.INVALID_MEDIA_KEY,
          "Quality must be between 1 and 100",
          400,
          "warn"
        );
      }
    }
  }

  private validateThumbnailRequest(req: Request): void {
    const { mediaKey } = req.params;
    const { width, height, quality } = req.query;

    if (!mediaKey || typeof mediaKey !== "string" || mediaKey.trim() === "") {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Media key is required and must be a non-empty string",
        400,
        "warn"
      );
    }

    if (!/^[a-zA-Z0-9._/-]+$/.test(mediaKey)) {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Media key contains invalid characters",
        400,
        "warn"
      );
    }

    if (width) {
      const widthNum = parseInt(width as string, 10);
      if (Number.isNaN(widthNum) || widthNum < 1 || widthNum > 2000) {
        throw new PreviewError(
          PreviewErrorCode.INVALID_MEDIA_KEY,
          "Width must be between 1 and 2000 pixels",
          400,
          "warn"
        );
      }
    }

    if (height) {
      const heightNum = parseInt(height as string, 10);
      if (Number.isNaN(heightNum) || heightNum < 1 || heightNum > 2000) {
        throw new PreviewError(
          PreviewErrorCode.INVALID_MEDIA_KEY,
          "Height must be between 1 and 2000 pixels",
          400,
          "warn"
        );
      }
    }

    if (quality) {
      const qualityNum = parseInt(quality as string, 10);
      if (Number.isNaN(qualityNum) || qualityNum < 1 || qualityNum > 100) {
        throw new PreviewError(
          PreviewErrorCode.INVALID_MEDIA_KEY,
          "Quality must be between 1 and 100",
          400,
          "warn"
        );
      }
    }
  }

  servePreview = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const { mediaKey } = req.params;
    const { size = "full", quality = 100 } = req.query;

    logger.info(
      { mediaKey, size, quality, userAgent: req.get("User-Agent") },
      "[PREVIEW-CONTROLLER] Preview request received"
    );

    try {
      this.validatePreviewRequest(req);

      const companyId = this.extractCompanyId(req);
      if (!companyId) {
        logger.error(
          { mediaKey },
          "[PREVIEW-CONTROLLER] Company ID not found in request context"
        );
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Validate permissions
      await this.validatePermissions(req, mediaKey, companyId);

      // Detect storage location
      const storageLocation =
        await this.storageDetectionService.detectStorageLocation(
          mediaKey,
          companyId
        );

      // Generate preview URL
      const previewURL =
        await this.previewURLGeneratorService.generatePreviewURL(
          mediaKey,
          storageLocation,
          companyId,
          {
            size: size as PreviewSize,
            quality: parseInt(quality as string, 10)
          }
        );

      // Set security headers
      this.setSecurityHeaders(res);

      // Set caching headers
      this.setCachingHeaders(res, 3600); // 1 hour cache

      const responseTime = Date.now() - startTime;
      logger.info(
        { mediaKey, previewURL, storageLocation, responseTime },
        "[PREVIEW-CONTROLLER] Preview URL generated successfully"
      );

      // For local storage, we might want to stream the file directly
      // For S3, we redirect to the signed URL
      if (storageLocation === "s3") {
        res.redirect(302, previewURL);
      } else {
        // For local files, we could either redirect or stream
        // Redirecting is simpler and consistent with S3 behavior
        res.redirect(302, previewURL);
      }
    } catch (error) {
      await this.handlePreviewError(error, req, res, "preview");
    }
  };

  serveThumbnail = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const { mediaKey } = req.params;
    const { width, height, quality = 80 } = req.query;

    logger.info(
      { mediaKey, width, height, quality, userAgent: req.get("User-Agent") },
      "[PREVIEW-CONTROLLER] Thumbnail request received"
    );

    try {
      this.validateThumbnailRequest(req);

      const companyId = this.extractCompanyId(req);
      if (!companyId) {
        logger.error(
          { mediaKey },
          "[PREVIEW-CONTROLLER] Company ID not found in request context"
        );
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      // Validate permissions
      await this.validatePermissions(req, mediaKey, companyId);

      // Detect storage location
      const storageLocation =
        await this.storageDetectionService.detectStorageLocation(
          mediaKey,
          companyId
        );

      // Get or generate thumbnail
      const thumbnailBuffer = await this.thumbnailHandlerService.getThumbnail(
        mediaKey,
        storageLocation,
        companyId,
        {
          width: width ? parseInt(width as string, 10) : undefined,
          height: height ? parseInt(height as string, 10) : undefined,
          quality: parseInt(quality as string, 10)
        }
      );

      // Set security headers
      this.setSecurityHeaders(res);

      // Set caching headers
      this.setCachingHeaders(res, 86400); // 24 hour cache for thumbnails

      // Set content type
      res.set("Content-Type", "image/jpeg");
      res.set("Content-Length", thumbnailBuffer.length.toString());
      res.set("Cache-Control", "public, max-age=86400"); // 24 hour cache

      const responseTime = Date.now() - startTime;
      logger.info(
        {
          mediaKey,
          storageLocation,
          thumbnailSize: thumbnailBuffer.length,
          responseTime
        },
        "[PREVIEW-CONTROLLER] Thumbnail served successfully"
      );

      res.send(thumbnailBuffer);
    } catch (error) {
      await this.handlePreviewError(error, req, res, "thumbnail");
    }
  };

  // eslint-disable-next-line class-methods-use-this
  private extractCompanyId(req: Request): number | null {
    if (req.user && (req.user as { companyId?: number }).companyId) {
      return (req.user as { companyId: number }).companyId;
    }

    if (req.query.companyId) {
      const companyId = parseInt(req.query.companyId as string, 10);
      return Number.isNaN(companyId) ? null : companyId;
    }

    if (req.headers["x-company-id"]) {
      const companyId = parseInt(req.headers["x-company-id"] as string, 10);
      return Number.isNaN(companyId) ? null : companyId;
    }

    return null;
  }

  private async validatePermissions(
    req: Request,
    mediaKey: string,
    companyId: number
  ): Promise<void> {
    // Basic path sanitization
    if (mediaKey.includes("..") || mediaKey.includes("//")) {
      throw new PreviewError(
        PreviewErrorCode.INVALID_MEDIA_KEY,
        "Invalid media key: path traversal detected",
        400,
        "warn",
        mediaKey,
        companyId
      );
    }

    // TODO: Implement proper permission checking
    // This should verify that the user has access to the media file
    // For now, we just ensure the user belongs to the same company

    const userCompanyId = this.extractCompanyId(req);
    if (userCompanyId !== companyId) {
      logger.warn(
        { mediaKey, userCompanyId, requestedCompanyId: companyId },
        "[PREVIEW-CONTROLLER] Company ID mismatch in permission validation"
      );
      throw new PreviewError(
        PreviewErrorCode.ACCESS_DENIED,
        "Access denied: insufficient permissions",
        403,
        "warn",
        mediaKey,
        companyId
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private setSecurityHeaders(res: Response): void {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private setCachingHeaders(res: Response, maxAge: number): void {
    res.set({
      "Cache-Control": `public, max-age=${maxAge}`,
      ETag: `"${Date.now()}"`, // Simple ETag based on current time
      "Last-Modified": new Date().toUTCString()
    });
  }

  private async handlePreviewError(
    error: Error,
    req: Request,
    res: Response,
    operation: "preview" | "thumbnail"
  ): Promise<void> {
    const { mediaKey } = req.params;
    const companyId = this.extractCompanyId(req);

    logger.error(
      {
        error: error.message,
        errorStack: error.stack,
        mediaKey,
        companyId,
        operation,
        userAgent: req.get("User-Agent")
      },
      `[PREVIEW-CONTROLLER] ${operation} operation failed`
    );

    if (error instanceof PreviewError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        operation
      });
      return;
    }

    // Generic error response
    res.status(500).json({
      error: `Failed to serve ${operation}`,
      code: PreviewErrorCode.INTERNAL_ERROR,
      operation
    });
  }
}
