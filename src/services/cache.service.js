/**
 * Cache Service - Redis-based
 * ============================
 * Abstraction layer for caching with Redis
 * Falls back to in-memory if Redis unavailable
 * 
 * Used by: brapi.client, yahoo.client, fixedIncome.service
 */

const { getRedis, isConnected } = require('../config/redis');
const { logger } = require('../config/logger');

// Fallback in-memory cache (when Redis is down)
const memoryCache = new Map();

// Default TTLs (seconds)
const DEFAULT_TTL = 900; // 15 minutes

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null
 */
const get = async (key) => {
    try {
        const redis = getRedis();
        if (redis && isConnected()) {
            const value = await redis.get(key);
            if (value) {
                return JSON.parse(value);
            }
        } else {
            // Fallback to memory
            const cached = memoryCache.get(key);
            if (cached && cached.expiry > Date.now()) {
                return cached.value;
            }
        }
    } catch (error) {
        logger.error(`❌ [CACHE] Error getting ${key}:`, error.message);
    }
    return null;
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 */
const set = async (key, value, ttl = DEFAULT_TTL) => {
    try {
        const redis = getRedis();
        if (redis && isConnected()) {
            await redis.setex(key, ttl, JSON.stringify(value));
        } else {
            // Fallback to memory
            memoryCache.set(key, {
                value,
                expiry: Date.now() + (ttl * 1000)
            });
        }
    } catch (error) {
        logger.error(`❌ [CACHE] Error setting ${key}:`, error.message);
    }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 */
const del = async (key) => {
    try {
        const redis = getRedis();
        if (redis && isConnected()) {
            await redis.del(key);
        } else {
            memoryCache.delete(key);
        }
    } catch (error) {
        logger.error(`❌ [CACHE] Error deleting ${key}:`, error.message);
    }
};

/**
 * Get multiple values from cache
 * @param {string[]} keys - Array of cache keys
 * @returns {Promise<Object>} - Map of key => value
 */
const getMultiple = async (keys) => {
    const results = {};

    try {
        const redis = getRedis();
        if (redis && isConnected()) {
            const values = await redis.mget(keys);
            keys.forEach((key, index) => {
                if (values[index]) {
                    results[key] = JSON.parse(values[index]);
                }
            });
        } else {
            // Fallback to memory
            for (const key of keys) {
                const cached = memoryCache.get(key);
                if (cached && cached.expiry > Date.now()) {
                    results[key] = cached.value;
                }
            }
        }
    } catch (error) {
        logger.error('❌ [CACHE] Error getting multiple keys:', error.message);
    }

    return results;
};

/**
 * Set multiple values in cache
 * @param {Object} keyValueMap - Object with key-value pairs
 * @param {number} ttl - Time to live in seconds
 */
const setMultiple = async (keyValueMap, ttl = DEFAULT_TTL) => {
    try {
        const redis = getRedis();
        if (redis && isConnected()) {
            const pipeline = redis.pipeline();
            for (const [key, value] of Object.entries(keyValueMap)) {
                pipeline.setex(key, ttl, JSON.stringify(value));
            }
            await pipeline.exec();
        } else {
            // Fallback to memory
            const expiry = Date.now() + (ttl * 1000);
            for (const [key, value] of Object.entries(keyValueMap)) {
                memoryCache.set(key, { value, expiry });
            }
        }
    } catch (error) {
        logger.error('❌ [CACHE] Error setting multiple keys:', error.message);
    }
};

/**
 * Flush all cache (use with caution)
 */
const flushAll = async () => {
    try {
        const redis = getRedis();
        if (redis && isConnected()) {
            // Only flush keys with our prefix to be safe
            const keys = await redis.keys('brapi:*');
            const yahooKeys = await redis.keys('yahoo:*');
            const rateKeys = await redis.keys('rates:*');

            const allKeys = [...keys, ...yahooKeys, ...rateKeys];
            if (allKeys.length > 0) {
                await redis.del(...allKeys);
            }
            logger.info(`🗑️ [CACHE] Flushed ${allKeys.length} keys`);
        } else {
            memoryCache.clear();
            logger.info('🗑️ [CACHE] Memory cache cleared');
        }
    } catch (error) {
        logger.error('❌ [CACHE] Error flushing:', error.message);
    }
};

// Cache key prefixes
const KEYS = {
    BRAPI_QUOTE: (ticker) => `brapi:quote:${ticker}`,
    YAHOO_QUOTE: (ticker) => `yahoo:quote:${ticker}`,
    MARKET_RATES: 'rates:market',
    FII_DATA: (ticker) => `fii:data:${ticker}`,
};

// TTL constants (seconds)
const TTL = {
    QUOTES: parseInt(process.env.CACHE_TTL_QUOTES) || 900,      // 15 min
    FII_DATA: parseInt(process.env.CACHE_TTL_FII_DATA) || 3600, // 1 hour
    RATES: parseInt(process.env.CACHE_TTL_RATES) || 3600,       // 1 hour
};

module.exports = {
    get,
    set,
    del,
    getMultiple,
    setMultiple,
    flushAll,
    KEYS,
    TTL
};
