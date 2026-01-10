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

const detectStorageLocation = async (
  mediaUrl: string
): Promise<"local" | "s3"> => {
  if (/^https?:\/\//.test(mediaUrl)) {
    return "s3";
  }

  try {
    const mediaKey = mediaUrl.replace(/^https?:\/\/[^/]+\/public\//, "");
    const fullPath = path.join(getPublicPath(), mediaKey);
    await fs.access(fullPath);
    return "local";
  } catch {
    return "s3";
  }
};

export const GetMediaStatsService = async (
  companyId: number
): Promise<MediaStats> => {
  logger.info({ companyId }, "[MEDIA-STATS] Calculating media statistics");

  const messages = await Message.findAll({
    where: {
      companyId,
      mediaUrl: { [Op.ne]: null }
    },
    attributes: ["mediaType", "mediaUrl", "fileSize", "createdAt"]
  });

  logger.info(
    { companyId, messageCount: messages.length },
    "[MEDIA-STATS] Messages retrieved from database"
  );

  const stats: MediaStats = {
    totalFiles: messages.length,
    totalSize: 0,
    byType: {},
    byLocation: { local: { count: 0, size: 0 }, s3: { count: 0, size: 0 } }
  };

  const locationPromises = messages.map(async msg => {
    const mediaUrl = msg.getDataValue("mediaUrl");
    if (!mediaUrl) return null;

    const location = await detectStorageLocation(mediaUrl);
    const type = msg.mediaType || "unknown";
    const fileSize = parseInt(msg.getDataValue("fileSize") || "0", 10);

    logger.debug(
      {
        messageId: msg.id,
        mediaUrl,
        fileSize,
        type,
        location
      },
      "[MEDIA-STATS] Processing media file"
    );

    return { type, location, fileSize };
  });

  const results = await Promise.all(locationPromises);

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

  logger.info(
    {
      companyId,
      totalFiles: stats.totalFiles,
      totalSize: stats.totalSize,
      byType: stats.byType,
      byLocation: stats.byLocation
    },
    "[MEDIA-STATS] Statistics calculated successfully"
  );

  return stats;
};
