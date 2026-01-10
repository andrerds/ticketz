#!/usr/bin/env node

import "../database";
import {
  MigrateCompanyFileSizesService,
  MigrateFileSizesService
} from "../services/MediaServices/MigrateFileSizesService";
import { logger } from "../utils/logger";

interface CliOptions {
  companyId?: number;
  batchSize?: number;
  dryRun?: boolean;
  help?: boolean;
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--company-id":
      case "-c":
        options.companyId = parseInt(args[++i], 10);
        break;
      case "--batch-size":
      case "-b":
        options.batchSize = parseInt(args[++i], 10);
        break;
      case "--dry-run":
      case "-d":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return options;
};

const showHelp = () => {
  console.log(`
Usage: npm run migrate:filesizes [options]

Options:
  -c, --company-id <id>    Migrate only files for specific company ID
  -b, --batch-size <size>  Number of records to process per batch (default: 100)
  -d, --dry-run           Run without making changes (preview mode)
  -h, --help              Show this help message

Examples:
  npm run migrate:filesizes                    # Migrate all companies
  npm run migrate:filesizes -c 1               # Migrate only company 1
  npm run migrate:filesizes -d                 # Dry run (preview only)
  npm run migrate:filesizes -c 1 -b 50 -d     # Company 1, batch size 50, dry run
`);
};

const main = async () => {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  logger.info(
    { options },
    "[CLI-MIGRATION] Starting fileSize migration script"
  );

  try {
    let progress;

    if (options.companyId) {
      console.log(
        `\n🚀 Migrating fileSize for company ${options.companyId}...`
      );
      progress = await MigrateCompanyFileSizesService(options.companyId, {
        batchSize: options.batchSize,
        dryRun: options.dryRun
      });
    } else {
      console.log("\n🚀 Migrating fileSize for all companies...");
      progress = await MigrateFileSizesService({
        batchSize: options.batchSize,
        dryRun: options.dryRun
      });
    }

    console.log("\n✅ Migration completed!");
    console.log(`📊 Results:`);
    console.log(`   Total messages: ${progress.total}`);
    console.log(`   Processed: ${progress.processed}`);
    console.log(`   Succeeded: ${progress.succeeded}`);
    console.log(`   Failed: ${progress.failed}`);

    if (options.dryRun) {
      console.log(
        "\n⚠️  This was a dry run - no changes were made to the database"
      );
    }

    if (progress.errors.length > 0) {
      console.log(`\n❌ Errors (${progress.errors.length}):`);
      progress.errors.slice(0, 10).forEach(error => {
        console.log(`   Message ${error.messageId}: ${error.error}`);
      });

      if (progress.errors.length > 10) {
        console.log(`   ... and ${progress.errors.length - 10} more errors`);
      }
    }

    process.exit(0);
  } catch (error: any) {
    logger.error(
      { error: error.message, errorStack: error.stack },
      "[CLI-MIGRATION] Migration script failed"
    );

    console.error("\n❌ Migration failed:");
    console.error(error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n⚠️  Migration interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Migration terminated");
  process.exit(1);
});

main();
