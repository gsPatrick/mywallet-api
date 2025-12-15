/**
 * Model Consent
 * Gerencia consentimentos Open Finance com conformidade LGPD
 * 
 * LGPD Compliance:
 * - Versionamento de consentimento
 * - Revogação imediata
 * - Expiração automática
 * - Política de retenção
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Consent = sequelize.define('Consent', {
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
        // ID do consentimento no Open Finance
        consentIdOF: {
            type: DataTypes.STRING(255),
            allowNull: true,
            unique: true
        },
        // Versionamento LGPD
        version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        status: {
            type: DataTypes.ENUM('AWAITING', 'AUTHORIZED', 'REVOKED', 'EXPIRED'),
            allowNull: false,
            defaultValue: 'AWAITING'
        },
        // Permissões solicitadas
        scopes: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
            defaultValue: []
        },
        // Nome da instituição transmissora
        transmitterName: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // URL do Authorization Server da transmissora
        authServerUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Resource Server URL
        resourceServerUrl: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Tokens (criptografados em produção)
        accessToken: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        refreshToken: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        tokenExpiresAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // PKCE
        codeVerifier: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        state: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Expiração do consentimento
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Revogação LGPD
        revokedAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        revokedReason: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Retenção de dados (dias)
        dataRetentionDays: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1825 // 5 anos
        }
    }, {
        tableName: 'consents',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['status'] },
            { fields: ['consent_id_o_f'], unique: true },
            { fields: ['expires_at'] }
        ]
    });

    // Métodos de instância

    /**
     * Verifica se o consentimento está válido
     */
    Consent.prototype.isValid = function () {
        if (this.status !== 'AUTHORIZED') {
            return false;
        }
        if (this.expiresAt && new Date() > this.expiresAt) {
            return false;
        }
        return true;
    };

    /**
     * Verifica se o token de acesso está válido
     */
    Consent.prototype.hasValidToken = function () {
        if (!this.accessToken) {
            return false;
        }
        if (this.tokenExpiresAt && new Date() > this.tokenExpiresAt) {
            return false;
        }
        return true;
    };

    /**
     * Revoga o consentimento
     */
    Consent.prototype.revoke = async function (reason = 'Revogado pelo usuário') {
        this.status = 'REVOKED';
        this.revokedAt = new Date();
        this.revokedReason = reason;
        this.accessToken = null;
        this.refreshToken = null;
        await this.save();
    };

    return Consent;
};
