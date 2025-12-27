/**
 * Model UserSession
 * ========================================
 * SESSÕES DE LOGIN DO USUÁRIO
 * ========================================
 * 
 * Rastreia cada dispositivo/login do usuário
 * Permite desconectar dispositivos remotamente
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserSession = sequelize.define('UserSession', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Device info
        deviceName: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Nome do dispositivo (ex: iPhone 14 Pro, Chrome on Windows)'
        },
        deviceType: {
            type: DataTypes.ENUM('mobile', 'desktop', 'tablet', 'other'),
            allowNull: false,
            defaultValue: 'desktop'
        },
        // Browser/OS info
        browser: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        os: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        // Connection info
        ipAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
            comment: 'IPv4 or IPv6'
        },
        userAgent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Session tracking
        token: {
            type: DataTypes.STRING(500),
            allowNull: false,
            comment: 'JWT token for this session'
        },
        tokenHash: {
            type: DataTypes.STRING(64),
            allowNull: true,
            comment: 'Hash of token for secure comparison'
        },
        // Activity
        lastActiveAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        // Current session flag
        isCurrent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            comment: 'Flag for identifying current session in API responses'
        },
        // Revocation
        isRevoked: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        revokedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'user_sessions',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['token'] },
            { fields: ['token_hash'] },
            { fields: ['is_revoked'] },
            { fields: ['last_active_at'] }
        ]
    });

    return UserSession;
};
