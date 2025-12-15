/**
 * Model Message
 * Mensagens e notificações do sistema
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Message = sequelize.define('Message', {
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
        // Tipo da mensagem
        type: {
            type: DataTypes.ENUM('SUPPORT', 'ADVICE', 'ALERT'),
            allowNull: false
        },
        // Título
        title: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Conteúdo
        text: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // Remetente (bot ou sistema)
        sender: {
            type: DataTypes.ENUM('BOT', 'SYSTEM', 'SUPPORT_AGENT'),
            defaultValue: 'BOT'
        },
        // Status de leitura
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // Metadados opcionais (JSON)
        data: {
            type: DataTypes.JSONB,
            allowNull: true
        }
    }, {
        tableName: 'messages',
        timestamps: true,
        indexes: [
            { fields: ['user_id'] },
            { fields: ['is_read'] }
        ]
    });

    return Message;
};
