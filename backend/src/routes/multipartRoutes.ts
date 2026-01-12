import { Router } from "express";
import * as MultipartUploadController from "../controllers/MultipartUploadController";
import isAuth from "../middleware/isAuth";

const multipartRoutes = Router();

multipartRoutes.post(
  "/multipart/start",
  isAuth,
  MultipartUploadController.startUpload
);

multipartRoutes.get(
  "/multipart/signed-url",
  isAuth,
  MultipartUploadController.getSignedUrl
);

multipartRoutes.post(
  "/multipart/complete",
  isAuth,
  MultipartUploadController.completeUpload
);

multipartRoutes.post(
  "/multipart/abort",
  isAuth,
  MultipartUploadController.abortUpload
);

export default multipartRoutes;
