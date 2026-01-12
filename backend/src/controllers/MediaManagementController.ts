import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { BulkDeleteMediaFilesService } from "../services/MediaServices/BulkDeleteMediaFilesService";
import { DebugS3Service } from "../services/MediaServices/DebugS3Service";
import { DeleteMediaFileService } from "../services/MediaServices/DeleteMediaFileService";
import { GetMediaStatsService } from "../services/MediaServices/GetMediaStatsService";
import {
  ListMediaFilesService,
  MediaFilters,
  PaginationParams
} from "../services/MediaServices/ListMediaFilesService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { startDate, endDate, fileType, storageLocation, limit, offset } =
    req.query;

  const filters: MediaFilters = {};

  if (startDate) {
    filters.startDate = new Date(startDate as string);
  }

  if (endDate) {
    filters.endDate = new Date(endDate as string);
  }

  if (fileType) {
    filters.fileType = fileType as string;
  }

  if (storageLocation) {
    filters.storageLocation = storageLocation as "local" | "s3";
  }

  const pagination: PaginationParams = {};

  if (limit) {
    const parsedLimit = parseInt(limit as string, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      pagination.limit = parsedLimit;
    }
  }

  if (offset) {
    const parsedOffset = parseInt(offset as string, 10);
    if (!isNaN(parsedOffset) && parsedOffset >= 0) {
      pagination.offset = parsedOffset;
    }
  }

  const result = await ListMediaFilesService(companyId, filters, pagination);

  return res.status(200).json(result);
};

export const stats = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const mediaStats = await GetMediaStatsService(companyId);

  return res.status(200).json(mediaStats);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id } = req.user;
  const { messageId } = req.params;

  const result = await DeleteMediaFileService({
    messageId,
    companyId,
    userId: Number(id)
  });

  if (!result.success) {
    throw new AppError(result.error || "Failed to delete media file", 500);
  }

  return res.status(200).json(result);
};

export const bulkRemove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id } = req.user;
  const { messageIds } = req.body;

  if (!Array.isArray(messageIds)) {
    throw new AppError("messageIds must be an array", 400);
  }

  const requests = messageIds.map(messageId => ({
    messageId,
    companyId,
    userId: Number(id)
  }));

  const results = await BulkDeleteMediaFilesService(requests);

  return res.status(200).json(results);
};

export const debugS3 = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const debugInfo = await DebugS3Service(companyId);

  return res.status(200).json(debugInfo);
};
