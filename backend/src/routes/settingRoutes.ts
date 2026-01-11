import { Router } from "express";
import multer from "multer";
import envTokenAuth from "../middleware/envTokenAuth";
import isAdmin from "../middleware/isAdmin";
import isAuth from "../middleware/isAuth";

import uploadPrivateConfig from "../config/privateFiles";
import uploadConfig from "../config/upload";
import * as SettingController from "../controllers/SettingController";
import isSuper from "../middleware/isSuper";

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

settingRoutes.delete(
  "/settings/storage/cache",
  isAuth,
  isAdmin,
  SettingController.clearStorageCache
);

settingRoutes.get("/settings/:settingKey", isAuth, SettingController.show);

settingRoutes.put(
  "/settings/:settingKey",
  isAuth,
  isAdmin,
  SettingController.update
);

export default settingRoutes;
