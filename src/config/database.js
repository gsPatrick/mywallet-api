/**
 * Configuração de Conexão com PostgreSQL
 * Utiliza Sequelize ORM com suporte a SSL e pool de conexões
 */

const { Sequelize } = require('sequelize');

// Configuração do banco de dados
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'openfinance_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',

    // Pool de conexões
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

    // Logging
    logging: process.env.NODE_ENV === 'development'
        ? (msg) => console.log(`[SQL] ${msg}`)
        : false,

    // Timezone
    timezone: '-03:00', // Brasília

    // Opções de definição padrão para models
    define: {
        timestamps: true,
        underscored: true, // snake_case nas colunas
        freezeTableName: true
    }
};

// Configuração SSL para produção
if (process.env.DB_SSL === 'true') {
    config.dialectOptions = {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    };
}

// Criar instância do Sequelize
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
);

module.exports = {
    sequelize,
    config
};
