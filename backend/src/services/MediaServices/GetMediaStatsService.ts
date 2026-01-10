import fs from "fs/promises";
import path from "path";
import { Op } from "sequelize";
import { getPublicPath } from "../../helpers/GetPublicPath";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, { count: number; size: number }>;
  byLocation: Record<string, { count: number; size: number }>;
}

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

export const GetMediaStatsService = async (
  companyId: number
): Promise<MediaStats> => {
  const messages = await Message.findAll({
    where: {
      companyId,
      mediaUrl: { [Op.ne]: null }
    },
    attributes: ["mediaType", "mediaUrl", "createdAt"]
  });

  const stats: MediaStats = {
    totalFiles: messages.length,
    totalSize: 0,
    byType: {},
    byLocation: { local: { count: 0, size: 0 }, s3: { count: 0, size: 0 } }
  };

  const fileSizePromises = messages.map(async msg => {
    const mediaUrl = msg.getDataValue("mediaUrl");
    if (!mediaUrl) return null;

    const isAbsoluteUrl = mediaUrl.match(/^https?:\/\//);
    const location: "local" | "s3" = isAbsoluteUrl ? "s3" : "local";
    const type = msg.mediaType || "unknown";

    const fileSize = await getFileSize(mediaUrl, location);

    return { type, location, fileSize };
  });

  const results = await Promise.all(fileSizePromises);

  results.forEach(result => {
    if (!result) return;

    const { type, location, fileSize } = result;

    if (!stats.byType[type]) {
      stats.byType[type] = { count: 0, size: 0 };
    }

    stats.byType[type].count += 1;
    stats.byType[type].size += fileSize;
    stats.byLocation[location].count += 1;
    stats.byLocation[location].size += fileSize;
    stats.totalSize += fileSize;
  });

  return stats;
};
