/**
 * Model AuditLog
 * ========================================
 * LOGS DE AUDITORIA LGPD
 * ========================================
 * 
 * ⚠️ APPEND-ONLY - IMUTÁVEL
 * 
 * - Registra todas as operações sensíveis
 * - Não pode ser editado
 * - Não pode ser excluído
 * - Conformidade com LGPD
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AuditLog = sequelize.define('AuditLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        // Usuário que realizou a ação (pode ser null para ações do sistema)
        userId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        // Tipo de ação
        action: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        // Recurso afetado
        resource: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        // ID do recurso afetado
        resourceId: {
            type: DataTypes.UUID,
            allowNull: true
        },
        // Detalhes da operação
        details: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        // Dados antes da alteração (para updates)
        previousData: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        // Dados após a alteração
        newData: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        // IP do cliente
        ipAddress: {
            type: DataTypes.STRING(45), // Suporta IPv6
            allowNull: true
        },
        // User Agent
        userAgent: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Timestamp da ação
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'audit_logs',
        timestamps: false, // Sem updatedAt - imutável
        hooks: {
            // Bloquear updates
            beforeUpdate: () => {
                throw new Error('Logs de auditoria são imutáveis e não podem ser alterados');
            },
            // Bloquear deletes
            beforeDestroy: () => {
                throw new Error('Logs de auditoria são imutáveis e não podem ser excluídos');
            }
        },
        indexes: [
            { fields: ['user_id'] },
            { fields: ['action'] },
            { fields: ['resource'] },
            { fields: ['created_at'] }
        ]
    });

    // Ações pré-definidas
    AuditLog.ACTIONS = {
        // Autenticação
        USER_REGISTER: 'USER_REGISTER',
        USER_LOGIN: 'USER_LOGIN',
        USER_LOGOUT: 'USER_LOGOUT',
        PASSWORD_CHANGE: 'PASSWORD_CHANGE',

        // Open Finance
        CONSENT_CREATE: 'CONSENT_CREATE',
        CONSENT_AUTHORIZE: 'CONSENT_AUTHORIZE',
        CONSENT_REVOKE: 'CONSENT_REVOKE',
        CONSENT_EXPIRE: 'CONSENT_EXPIRE',
        DATA_IMPORT: 'DATA_IMPORT',

        // Transações
        TRANSACTION_CREATE: 'TRANSACTION_CREATE',
        TRANSACTION_UPDATE: 'TRANSACTION_UPDATE',
        TRANSACTION_DELETE: 'TRANSACTION_DELETE',
        METADATA_UPDATE: 'METADATA_UPDATE',

        // LGPD
        DATA_EXPORT: 'DATA_EXPORT',
        DATA_PURGE: 'DATA_PURGE',
        DATA_ACCESS: 'DATA_ACCESS'
    };

    // Método estático para criar log
    AuditLog.log = async function (params) {
        return this.create({
            userId: params.userId || null,
            action: params.action,
            resource: params.resource,
            resourceId: params.resourceId || null,
            details: params.details || null,
            previousData: params.previousData || null,
            newData: params.newData || null,
            ipAddress: params.ipAddress || null,
            userAgent: params.userAgent || null
        });
    };

    return AuditLog;
};
