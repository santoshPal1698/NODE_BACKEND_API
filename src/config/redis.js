// src/config/redis.js
const Redis = require("ioredis");

const cleanEnv = (val) => (val ? val.split("#")[0].trim() : "");

const buildRedisClient = () => {
  const redisUrl = cleanEnv(process.env.REDIS_URL);

  // ── Option A: Full URI (Redis Cloud) ───────────────────────────────────────
  // WHY check URL prefix?
  //  "redis://"  = plain connection  → NO TLS
  //  "rediss://" = secure connection → TLS required
  // Redis Cloud free tier uses "redis://" (no TLS on public endpoint).
  // Forcing tls:{} on a "redis://" URL causes "wrong version number" SSL error
  // because the server expects plain TCP but we're sending SSL handshake.

  if (redisUrl && (redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://"))) {
    const isTLS = redisUrl.startsWith("rediss://");
    console.log(`🔧 Redis mode: URI connection (Redis Cloud)`);
    console.log(`🔒 TLS: ${isTLS ? "YES (rediss://)" : "NO (redis://)"}`);
    console.log(`📦 Redis URL: ${redisUrl.replace(/:([^:@]+)@/, ':****@')}`);

    const options = {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 5) {
          console.error("❌ Redis Cloud: max reconnect attempts reached. Running without cache.");
          return null;
        }
        const delay = Math.min(times * 500, 3000);
        console.log(`🔄 Redis retry #${times} in ${delay}ms...`);
        return delay;
      },
      enableOfflineQueue: false,
      connectTimeout: 10000,
      keepAlive: 30000,
    };

    // Only add TLS config if URL is rediss:// (secure)
    if (isTLS) {
      options.tls = {};
    }

    return new Redis(redisUrl, options);
  }

  // ── Option B: Host/Port/Password (Local Redis) ─────────────────────────────
  const host = cleanEnv(process.env.REDIS_HOST) || "127.0.0.1";
  const port = parseInt(cleanEnv(process.env.REDIS_PORT)) || 6379;
  const password = cleanEnv(process.env.REDIS_PASSWORD);
  const isCloud = host !== "127.0.0.1" && host !== "localhost";

  // console.log(`🔧 Redis mode: Host/Port (${isCloud ? "Cloud" : "Local"})`);
  // console.log(`📦 Redis target: ${host}:${port}`);

  return new Redis({
    host,
    port,
    ...(password ? { password } : {}),
    ...(isCloud ? { tls: {} } : {}),
    retryStrategy: (times) => {
      if (times > 5) {
        console.error("❌ Redis: max reconnect attempts reached. Running without cache.");
        return null;
      }
      return Math.min(times * 500, 3000);
    },
    enableOfflineQueue: false,
    connectTimeout: 10000,
    keepAlive: 30000,
  });
};

const redisClient = buildRedisClient();
redisClient.on("connect", () => console.log("✅ Redis connected successfully"));
redisClient.on("ready", () => console.log("✅✅ Redis ready to accept commands ✅✅"));
redisClient.on("error", (err) => console.error("❌ Redis connection error:", err.message));
redisClient.on("close", () => console.log("🔌 Redis connection closed"));
redisClient.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));

module.exports = redisClient;