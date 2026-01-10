import { DataTypes, QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.addColumn("Messages", "fileSize", {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: null,
      comment: "Size of the media file in bytes"
    });

    // Add index for performance on fileSize queries
    await queryInterface.addIndex("Messages", ["fileSize"], {
      name: "idx_messages_filesize"
    });

    // Add composite index for media queries with fileSize
    await queryInterface.addIndex(
      "Messages",
      ["companyId", "mediaUrl", "fileSize"],
      {
        name: "idx_messages_company_media_filesize"
      }
    );
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    // Remove indexes first
    await queryInterface.removeIndex(
      "Messages",
      "idx_messages_company_media_filesize"
    );
    await queryInterface.removeIndex("Messages", "idx_messages_filesize");

    // Remove column
    await queryInterface.removeColumn("Messages", "fileSize");
  }
};
