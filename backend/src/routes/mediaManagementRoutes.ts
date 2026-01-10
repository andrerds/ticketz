import { Router } from "express";
import isAdmin from "../middleware/isAdmin";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";

import * as MediaManagementController from "../controllers/MediaManagementController";

const mediaManagementRoutes = Router();

mediaManagementRoutes.get(
  "/media",
  isAuth,
  isAdmin,
  isCompliant,
  MediaManagementController.index
);

mediaManagementRoutes.get(
  "/media/stats",
  isAuth,
  isAdmin,
  isCompliant,
  MediaManagementController.stats
);

mediaManagementRoutes.delete(
  "/media/:messageId",
  isAuth,
  isAdmin,
  isCompliant,
  MediaManagementController.remove
);

mediaManagementRoutes.post(
  "/media/bulk-delete",
  isAuth,
  isAdmin,
  isCompliant,
  MediaManagementController.bulkRemove
);

// Development-only S3 debug endpoint
mediaManagementRoutes.get(
  "/media/s3-debug",
  isAuth,
  isAdmin,
  isCompliant,
  MediaManagementController.debugS3
);

export default mediaManagementRoutes;
