const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PatchNote = sequelize.define('PatchNote', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        version: {
            type: DataTypes.STRING,
            allowNull: false,
            // unique: true, // Moved to indexes to avoid sync error with alter: true
            comment: 'Version number like 1.01',
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        releaseDate: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updates: {
            type: DataTypes.JSONB,
            defaultValue: [],
            comment: 'Array of updates: [{ type: "new"|"fix"|"change", content: "string" }]',
        },
        bannerUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'URL for the patch note banner image',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        tableName: 'patch_notes',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['version']
            }
        ]
    });

    return PatchNote;
};
