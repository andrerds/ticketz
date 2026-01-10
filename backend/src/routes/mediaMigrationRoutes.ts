import express from "express";
import {
  migrateAllFileSizes,
  migrateCompanyFileSizes
} from "../controllers/MediaMigrationController";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";

const mediaMigrationRoutes = express.Router();

// Global migration (super admin only)
mediaMigrationRoutes.post(
  "/migrate/filesizes/all",
  isAuth,
  isSuper,
  migrateAllFileSizes
);

// Company-specific migration (super admin only)
mediaMigrationRoutes.post(
  "/migrate/filesizes/company",
  isAuth,
  isSuper,
  migrateCompanyFileSizes
);

export default mediaMigrationRoutes;
