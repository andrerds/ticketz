import { Router } from "express";
import { PreviewController } from "../controllers/PreviewController";
import isAuth from "../middleware/isAuth";

const previewRoutes = Router();
const previewController = new PreviewController();

// Apply authentication middleware to all preview routes
previewRoutes.use(isAuth);

// Preview endpoints
previewRoutes.get("/preview/:mediaKey", previewController.servePreview);

previewRoutes.get("/thumbnail/:mediaKey", previewController.serveThumbnail);

export default previewRoutes;
