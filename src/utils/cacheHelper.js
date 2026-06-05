// src/utils/cacheHelper.js
const redisClient = require("../config/redis");

/**
 * Returns true if Redis is currently connected and usable.
 * If Redis is down, all cache operations are silently skipped
 * and the app falls back to MongoDB — zero downtime.
 */
const isRedisReady = () => {
  return redisClient.status === "ready";
};

/**
 * Get from cache, or fetch from DB and cache the result.
 * Falls back to direct DB fetch if Redis is unavailable.
 *
 * @param {string}   key     - Redis cache key (e.g. "portfolio:all")
 * @param {number}   ttl     - Seconds before expiry
 * @param {Function} fetchFn - Async function returning fresh data from MongoDB
 */
const getOrSetCache = async (key, ttl, fetchFn) => {
  // ── If Redis is down, skip cache entirely ──────────────────────────────
  if (!isRedisReady()) {
    console.warn(`⚠️  Redis unavailable — fetching "${key}" directly from DB`);
    return await fetchFn();
  }

  try {
    // 1. Check Redis
    const cached = await redisClient.get(key);
    if (cached) {
      console.log(`✅ Cache HIT for set Local data bases: ${key}`);
      return JSON.parse(cached);
    }

    // 2. Cache MISS — hit MongoDB
    console.log(`❌ Cache MISS: ${key} — querying MongoDB`);
    const fresh = await fetchFn();

    // 3. Store in Redis with TTL
    await redisClient.set(key, JSON.stringify(fresh), "EX", ttl);
    console.log(`💾 Cached: ${key} (TTL: ${ttl}s)`);

    return fresh;
  } catch (err) {
    // Redis threw — fall back to DB silently
    console.error(`⚠️  Cache error for "${key}":`, err.message);
    return await fetchFn();
  }
};

/**
 * Invalidate (delete) one or more cache keys after a write operation.
 * Safe to call even when Redis is down.
 *
 * @param {...string} keys
 */
const invalidateCache = async (...keys) => {
  if (!isRedisReady() || keys.length === 0) return;
  try {
    await redisClient.del(...keys);
    console.log(`🗑️  Cache invalidated: ${keys.join(", ")}`);
  } catch (err) {
    console.error("⚠️  Cache invalidation error:", err.message);
  }
};

module.exports = { getOrSetCache, invalidateCache };