/**
 * Redis Configuration
 * ====================
 * Centralized Redis client for shared caching
 * 
 * Benefits:
 * - Cache shared across all users
 * - Persists across server restarts
 * - Supports horizontal scaling
 */

const Redis = require('ioredis');
const { logger } = require('./logger');

// Redis URL format: redis://[user]:[password]@[host]:[port]
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;

/**
 * Initialize Redis connection
 */
const initRedis = () => {
    if (redis) return redis;

    try {
        redis = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    logger.error('❌ [REDIS] Max retries reached, giving up');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 200, 2000);
                logger.warn(`⚠️ [REDIS] Retry attempt ${times}, waiting ${delay}ms`);
                return delay;
            },
            lazyConnect: true, // Don't connect immediately
        });

        redis.on('connect', () => {
            logger.info('✅ [REDIS] Connected successfully');
        });

        redis.on('error', (err) => {
            logger.error('❌ [REDIS] Connection error:', err.message);
        });

        redis.on('close', () => {
            logger.warn('⚠️ [REDIS] Connection closed');
        });

        // Attempt to connect
        redis.connect().catch((err) => {
            logger.error('❌ [REDIS] Initial connection failed:', err.message);
        });

        return redis;
    } catch (error) {
        logger.error('❌ [REDIS] Failed to initialize:', error.message);
        return null;
    }
};

/**
 * Get Redis client instance
 */
const getRedis = () => {
    if (!redis) {
        return initRedis();
    }
    return redis;
};

/**
 * Gracefully disconnect Redis
 */
const disconnectRedis = async () => {
    if (redis) {
        await redis.quit();
        redis = null;
        logger.info('🔌 [REDIS] Disconnected');
    }
};

/**
 * Check if Redis is connected
 */
const isConnected = () => {
    return redis && redis.status === 'ready';
};

module.exports = {
    initRedis,
    getRedis,
    disconnectRedis,
    isConnected
};
