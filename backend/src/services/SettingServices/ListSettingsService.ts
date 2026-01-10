import { Op, WhereOptions } from "sequelize";
import Setting from "../../models/Setting";

interface Request {
  isSuper: boolean;
  companyId: number;
}

const maskS3Secrets = (settings: Setting[]): Setting[] => {
  return settings.map(setting => {
    if (setting.key === "storageS3Config" && setting.value) {
      try {
        const config = JSON.parse(setting.value);
        if (config.secretAccessKey) {
          config.secretAccessKey = "*****";
          const maskedSetting = { ...setting.toJSON() };
          maskedSetting.value = JSON.stringify(config);
          return maskedSetting as Setting;
        }
      } catch (error) {
        // If parsing fails, return original
      }
    }
    return setting;
  });
};

const ListSettingsService = async ({
  isSuper,
  companyId
}: Request): Promise<Setting[] | undefined> => {
  const where: WhereOptions = { companyId };
  if (!isSuper) {
    where.key = {
      [Op.notLike]: "\\_%"
    };
  }

  const settings = await Setting.findAll({
    where
  });

  return maskS3Secrets(settings);
};

export default ListSettingsService;
