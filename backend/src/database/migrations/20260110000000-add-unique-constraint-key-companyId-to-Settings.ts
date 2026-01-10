import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.addConstraint("Settings", {
      fields: ["key", "companyId"],
      type: "unique",
      name: "Settings_key_companyId_unique"
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeConstraint(
      "Settings",
      "Settings_key_companyId_unique"
    );
  }
};
