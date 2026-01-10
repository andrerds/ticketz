/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
import { Op } from "sequelize";
import { StorageDriverFactory } from "../../infrastructure/storage/StorageDriverFactory";
import Message from "../../models/Message";
import { logger } from "../../utils/logger";
import GetStorageConfigService from "../StorageServices/GetStorageConfigService";

export interface MigrationProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
}

export interface MigrationOptions {
  companyId?: number;
  batchSize?: number;
  dryRun?: boolean;
}

export const MigrateFileSizesService = async (
  options: MigrationOptions = {}
): Promise<MigrationProgress> => {
  const { companyId, batchSize = 100, dryRun = false } = options;

  logger.info(
    { companyId, batchSize, dryRun },
    "[FILESIZE-MIGRATION] Starting fileSize migration"
  );

  const whereClause: Record<string, unknown> = {
    mediaUrl: { [Op.ne]: null },
    fileSize: { [Op.is]: null } // Only migrate records without fileSize
  };

  if (companyId) {
    whereClause.companyId = companyId;
  }

  // Get total count for progress tracking
  const totalCount = await Message.count({ where: whereClause });

  logger.info(
    { totalCount, companyId },
    "[FILESIZE-MIGRATION] Found messages to migrate"
  );

  const progress: MigrationProgress = {
    total: totalCount,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: []
  };

  if (totalCount === 0) {
    logger.info("[FILESIZE-MIGRATION] No messages need fileSize migration");
    return progress;
  }

  let offset = 0;

  while (offset < totalCount) {
    logger.info(
      { offset, batchSize, remaining: totalCount - offset },
      "[FILESIZE-MIGRATION] Processing batch"
    );

    // eslint-disable-next-line no-await-in-loop
    const messages = await Message.findAll({
      where: whereClause,
      limit: batchSize,
      offset,
      order: [["createdAt", "ASC"]]
    });

    if (messages.length === 0) {
      break;
    }

    const processMessage = async (message: Message): Promise<void> => {
      try {
        progress.processed++;

        const mediaUrl = message.getDataValue("mediaUrl");
        if (!mediaUrl) {
          progress.failed++;
          progress.errors.push({
            messageId: message.id,
            error: "No mediaUrl found"
          });
          return;
        }

        // Get storage configuration for the company
        const storageConfig = await GetStorageConfigService({
          companyId: message.companyId
        });

        // Create appropriate storage driver
        const driver = await StorageDriverFactory.createDriver(storageConfig);

        // Extract media key from URL
        const mediaKey = mediaUrl.replace(/^https?:\/\/[^/]+\/public\//, "");

        // Get file size from storage
        const fileSize = await driver.getFileSize(mediaKey);

        if (fileSize > 0) {
          if (!dryRun) {
            // Update the message with the calculated fileSize
            await message.update({ fileSize });
          }

          progress.succeeded++;

          logger.debug(
            {
              messageId: message.id,
              companyId: message.companyId,
              mediaKey,
              fileSize,
              dryRun
            },
            "[FILESIZE-MIGRATION] Successfully calculated fileSize"
          );
        } else {
          progress.failed++;
          progress.errors.push({
            messageId: message.id,
            error: `File not found or size is 0: ${mediaKey}`
          });

          logger.warn(
            {
              messageId: message.id,
              companyId: message.companyId,
              mediaKey
            },
            "[FILESIZE-MIGRATION] File not found or size is 0"
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        progress.failed++;
        progress.errors.push({
          messageId: message.id,
          error: errorMessage
        });

        logger.error(
          {
            messageId: message.id,
            companyId: message.companyId,
            error: errorMessage,
            errorStack
          },
          "[FILESIZE-MIGRATION] Error processing message"
        );
      }

      // Log progress every 50 messages
      if (progress.processed % 50 === 0) {
        logger.info(
          {
            processed: progress.processed,
            total: progress.total,
            succeeded: progress.succeeded,
            failed: progress.failed,
            percentage: Math.round((progress.processed / progress.total) * 100)
          },
          "[FILESIZE-MIGRATION] Progress update"
        );
      }
    };

    // Process messages in parallel with controlled concurrency
    await Promise.all(messages.map(processMessage));

    offset += batchSize;

    // Small delay to avoid overwhelming the system
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 100);
    });
  }

  logger.info(
    {
      total: progress.total,
      processed: progress.processed,
      succeeded: progress.succeeded,
      failed: progress.failed,
      errorCount: progress.errors.length,
      dryRun
    },
    "[FILESIZE-MIGRATION] Migration completed"
  );

  return progress;
};

export const MigrateCompanyFileSizesService = async (
  companyId: number,
  options: Omit<MigrationOptions, "companyId"> = {}
): Promise<MigrationProgress> => {
  return MigrateFileSizesService({ ...options, companyId });
};
