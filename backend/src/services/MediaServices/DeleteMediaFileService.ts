import AppError from "../../errors/AppError";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "../StorageServices/GetStorageConfigService";

export interface DeleteMediaRequest {
  messageId: string;
  companyId: number;
  userId: number;
}

export interface DeleteMediaResult {
  success: boolean;
  messageId: string;
  error?: string;
}

export const DeleteMediaFileService = async (
  request: DeleteMediaRequest
): Promise<DeleteMediaResult> => {
  try {
    const message = await Message.findOne({
      where: {
        id: request.messageId,
        companyId: request.companyId
      }
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (message.createdAt >= thirtyDaysAgo) {
      throw new AppError("Cannot delete media files newer than 30 days", 403);
    }

    const mediaUrl = message.getDataValue("mediaUrl");
    if (!mediaUrl) {
      throw new AppError("Message has no media", 400);
    }

    const config = await GetStorageConfigService({
      companyId: request.companyId
    });
    const driver = await StorageDriverFactory.createDriver(config);

    const mediaKey = mediaUrl.replace(/^https?:\/\/[^/]+\/public\//, "");

    try {
      await driver.delete(mediaKey);
    } catch (error) {
      logger.warn(
        { error, mediaKey },
        "Failed to delete media file from storage"
      );
    }

    await message.update({
      isDeleted: true,
      mediaUrl: `deleted:${mediaUrl}`
    });

    logger.info(
      {
        messageId: request.messageId,
        userId: request.userId,
        companyId: request.companyId,
        mediaUrl
      },
      "Media file manually deleted"
    );

    return {
      success: true,
      messageId: request.messageId
    };
  } catch (error) {
    logger.error({ error, request }, "Error deleting media file");
    return {
      success: false,
      messageId: request.messageId,
      error: error.message
    };
  }
};
