import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import envTokenAuth from "../middleware/envTokenAuth";

import * as SettingController from "../controllers/SettingController";
import isSuper from "../middleware/isSuper";
import uploadConfig from "../config/upload";
import uploadPrivateConfig from "../config/privateFiles";

const settingRoutes = Router();

settingRoutes.get("/settings", isAuth, isAdmin, SettingController.index);

settingRoutes.get(
  "/public-settings/:settingKey",
  envTokenAuth,
  SettingController.publicShow
);

const upload = multer(uploadConfig);
const uploadPrivate = multer(uploadPrivateConfig);

settingRoutes.post(
  "/settings/logo",
  isAuth,
  isSuper,
  upload.single("file"),
  SettingController.storeLogo
);

settingRoutes.post(
  "/settings/privateFile",
  isAuth,
  isSuper,
  uploadPrivate.single("file"),
  SettingController.storePrivateFile
);

settingRoutes.get(
  "/settings/storage",
  isAuth,
  isAdmin,
  SettingController.getStorageSettings
);

settingRoutes.put(
  "/settings/storage",
  isAuth,
  isAdmin,
  SettingController.updateStorageSettings
);

settingRoutes.post(
  "/settings/storage/test",
  isAuth,
  isAdmin,
  SettingController.testStorageConnection
);

settingRoutes.get("/settings/:settingKey", isAuth, SettingController.show);

settingRoutes.put(
  "/settings/:settingKey",
  isAuth,
  isAdmin,
  SettingController.update
);

export default settingRoutes;
