import fs from "fs/promises";
import path from "path";
import { Op } from "sequelize";
import { getPublicPath } from "../../helpers/GetPublicPath";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";

export interface MediaFileInfo {
  id: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  fileType: string;
  storageLocation: "local" | "s3";
  messageId: string;
  mediaUrl: string;
  isDeleted: boolean;
  canDelete: boolean;
}

export interface MediaFilters {
  startDate?: Date;
  endDate?: Date;
  fileType?: string;
  storageLocation?: "local" | "s3";
}

const extractFileName = (mediaUrl: string): string => {
  if (!mediaUrl) return "unknown";
  const parts = mediaUrl.split("/");
  return parts[parts.length - 1];
};

const detectStorageLocation = async (
  mediaUrl: string,
  companyId: number
): Promise<"local" | "s3"> => {
  if (/^https?:\/\//.test(mediaUrl)) {
    return "s3";
  }

  const mediaKey = mediaUrl.replace(/^\/public\//, "");
  const fullPath = path.join(getPublicPath(), mediaKey);

  try {
    await fs.access(fullPath);
    return "local";
  } catch {
    return "s3";
  }
};

export const ListMediaFilesService = async (
  companyId: number,
  filters?: MediaFilters
): Promise<MediaFileInfo[]> => {
  const whereClause = {
    companyId,
    mediaUrl: { [Op.ne]: null },
    ...(filters?.startDate || filters?.endDate ? { createdAt: {} } : {}),
    ...(filters?.fileType ? { mediaType: filters.fileType } : {})
  } as {
    companyId: number;
    mediaUrl: { [Op.ne]: null };
    createdAt?: Record<symbol, Date>;
    mediaType?: string;
  };

  if (filters?.startDate && whereClause.createdAt) {
    whereClause.createdAt[Op.gte] = filters.startDate;
  }
  if (filters?.endDate && whereClause.createdAt) {
    whereClause.createdAt[Op.lte] = filters.endDate;
  }

  logger.info(
    { companyId, filters },
    "[MEDIA-LIST] Fetching media files from database"
  );

  const messages = await Message.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]]
  });

  logger.info(
    { companyId, messageCount: messages.length },
    "[MEDIA-LIST] Messages retrieved from database"
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const mediaFiles = await Promise.all(
    messages.map(async msg => {
      const mediaUrl = msg.getDataValue("mediaUrl");
      if (!mediaUrl) return null;

      const storageLocation = await detectStorageLocation(mediaUrl, companyId);

      if (
        filters?.storageLocation &&
        storageLocation !== filters.storageLocation
      ) {
        return null;
      }

      // Use fileSize from database, fallback to 0 for legacy records
      const fileSize = msg.fileSize || 0;

      logger.debug(
        {
          messageId: msg.id,
          mediaUrl,
          fileSize,
          storageLocation,
          hasFileSize: !!msg.fileSize
        },
        "[MEDIA-LIST] Processing media file"
      );

      return {
        id: msg.id,
        fileName: extractFileName(mediaUrl),
        fileSize,
        uploadDate: msg.createdAt,
        fileType: msg.mediaType || "unknown",
        storageLocation,
        messageId: msg.id,
        mediaUrl,
        isDeleted: msg.isDeleted,
        canDelete: msg.createdAt < thirtyDaysAgo
      };
    })
  );

  const filteredFiles = mediaFiles.filter(
    (file): file is MediaFileInfo => file !== null
  );

  logger.info(
    {
      companyId,
      totalFiles: filteredFiles.length,
      filesWithSize: filteredFiles.filter(f => f.fileSize > 0).length,
      legacyFiles: filteredFiles.filter(f => f.fileSize === 0).length
    },
    "[MEDIA-LIST] Media files processed successfully"
  );

  return filteredFiles;
};
