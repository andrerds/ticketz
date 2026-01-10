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

const getFileSize = async (
  mediaUrl: string,
  storageLocation: "local" | "s3"
): Promise<number> => {
  if (storageLocation === "local") {
    try {
      const mediaKey = mediaUrl.replace(/^https?:\/\/[^/]+\/public\//, "");
      const fullPath = path.join(getPublicPath(), mediaKey);
      const stats = await fs.stat(fullPath);
      return stats.size;
    } catch (error) {
      logger.warn({ error, mediaUrl }, "Failed to get file size");
      return 0;
    }
  }
  return 0;
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

  const messages = await Message.findAll({
    where: whereClause,
    order: [["createdAt", "DESC"]]
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const mediaFiles = await Promise.all(
    messages.map(msg => {
      const mediaUrl = msg.getDataValue("mediaUrl");
      if (!mediaUrl) return null;

      const storageLocation: "local" | "s3" = /^https?:/.test(mediaUrl)
        ? "s3"
        : "local";

      if (
        filters?.storageLocation &&
        storageLocation !== filters.storageLocation
      ) {
        return null;
      }

      return (async (): Promise<MediaFileInfo> => {
        const fileSize = await getFileSize(mediaUrl, storageLocation);

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
      })();
    })
  );

  return mediaFiles.filter((file): file is MediaFileInfo => file !== null);
};
