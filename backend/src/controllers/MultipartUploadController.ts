import { Request, Response } from "express";
import { MultipartUploadService } from "../services/StorageServices/MultipartUploadService";
import { logger } from "../utils/logger";

const service = new MultipartUploadService();

export const startUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { filename, contentType, fileSize } = req.body;

    if (!filename || !contentType || !fileSize) {
      return res.status(400).json({
        error: "Missing required fields: filename, contentType, fileSize"
      });
    }

    const result = await service.startUpload({
      filename,
      contentType,
      fileSize: parseInt(fileSize, 10),
      companyId
    });

    return res.json(result);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error(
      { error: err.message },
      "[MULTIPART-CONTROLLER] Start upload failed"
    );
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

export const getSignedUrl = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { uploadId, key, partNumber } = req.query;

    if (!uploadId || !key || !partNumber) {
      return res.status(400).json({
        error: "Missing required query parameters: uploadId, key, partNumber"
      });
    }

    const signedUrl = await service.getSignedUrl(
      uploadId as string,
      key as string,
      parseInt(partNumber as string, 10),
      companyId
    );

    return res.json({ signedUrl });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error(
      { error: err.message },
      "[MULTIPART-CONTROLLER] Get signed URL failed"
    );
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

export const completeUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { uploadId, key, parts } = req.body;

    if (!uploadId || !key || !parts || !Array.isArray(parts)) {
      return res.status(400).json({
        error: "Missing required fields: uploadId, key, parts (array)"
      });
    }

    const location = await service.completeUpload(
      uploadId,
      key,
      parts,
      companyId
    );

    return res.json({ location, key });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error(
      { error: err.message },
      "[MULTIPART-CONTROLLER] Complete upload failed"
    );
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};

export const abortUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { uploadId, key } = req.body;

    if (!uploadId || !key) {
      return res.status(400).json({
        error: "Missing required fields: uploadId, key"
      });
    }

    await service.abortUpload(uploadId, key, companyId);

    return res.json({ success: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error(
      { error: err.message },
      "[MULTIPART-CONTROLLER] Abort upload failed"
    );
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
};
