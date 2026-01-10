import { Request, Response } from "express";
import {
  MigrateCompanyFileSizesService,
  MigrateFileSizesService
} from "../services/MediaServices/MigrateFileSizesService";
import { logger } from "../utils/logger";

interface MigrationRequest extends Request {
  body: {
    companyId?: number;
    batchSize?: number;
    dryRun?: boolean;
  };
}

export const migrateAllFileSizes = async (
  req: MigrationRequest,
  res: Response
): Promise<Response> => {
  try {
    const { batchSize = 100, dryRun = false } = req.body;

    logger.info(
      {
        userId: req.user?.id,
        batchSize,
        dryRun
      },
      "[MIGRATION-API] Starting global fileSize migration"
    );

    const progress = await MigrateFileSizesService({
      batchSize,
      dryRun
    });

    logger.info(
      {
        userId: req.user?.id,
        progress
      },
      "[MIGRATION-API] Global fileSize migration completed"
    );

    return res.json({
      success: true,
      message: dryRun
        ? "Dry run completed successfully"
        : "Migration completed successfully",
      progress
    });
  } catch (error: any) {
    logger.error(
      {
        userId: req.user?.id,
        error: error.message,
        errorStack: error.stack
      },
      "[MIGRATION-API] Error in global fileSize migration"
    );

    return res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message
    });
  }
};

export const migrateCompanyFileSizes = async (
  req: MigrationRequest,
  res: Response
): Promise<Response> => {
  try {
    const { companyId, batchSize = 100, dryRun = false } = req.body;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required"
      });
    }

    logger.info(
      {
        userId: req.user?.id,
        companyId,
        batchSize,
        dryRun
      },
      "[MIGRATION-API] Starting company fileSize migration"
    );

    const progress = await MigrateCompanyFileSizesService(companyId, {
      batchSize,
      dryRun
    });

    logger.info(
      {
        userId: req.user?.id,
        companyId,
        progress
      },
      "[MIGRATION-API] Company fileSize migration completed"
    );

    return res.json({
      success: true,
      message: dryRun
        ? "Dry run completed successfully"
        : "Migration completed successfully",
      progress
    });
  } catch (error: any) {
    logger.error(
      {
        userId: req.user?.id,
        companyId: req.body.companyId,
        error: error.message,
        errorStack: error.stack
      },
      "[MIGRATION-API] Error in company fileSize migration"
    );

    return res.status(500).json({
      success: false,
      message: "Migration failed",
      error: error.message
    });
  }
};
