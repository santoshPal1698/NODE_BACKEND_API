
const redisClient = require("../config/redis");
// ── Configuration ────────────────────────────────────────────────────────────
const RATE_LIMIT_CONFIG = {
    maxRequests: 85,              // Max requests allowed per day
    windowSecs: 24 * 60 * 60,   // 86400 seconds = 1 full day
    keyPrefix: "ratelimit",     // Redis key prefix for easy identification
};

// ── Helper: get today's date string (YYYY-MM-DD) ─────────────────────────────
// WHY date in key: automatically resets at midnight without any cron job.
// A new date = a new key = fresh counter. Old key expires via Redis TTL.
const getTodayDate = () => {
    return new Date().toISOString().split("T")[0]; // "2024-06-05"
};

// ── Helper: get real client IP ────────────────────────────────────────────────
// WHY: Behind a proxy (Nginx, Render, Railway, Heroku), req.ip returns
// the proxy IP (127.0.0.1), not the real user IP.
// x-forwarded-for header contains the real IP chain.
const getClientIP = (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        // x-forwarded-for can be "clientIP, proxy1IP, proxy2IP"
        // First value is always the real client IP
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.connection.remoteAddress || "unknown";
};

// ── Main rate limiter middleware ──────────────────────────────────────────────
const rateLimiter = async (req, res, next) => {
    // console.log("this method called ratlimmiting",req)
    const ip = getClientIP(req);
    const today = getTodayDate();
    const key = `${RATE_LIMIT_CONFIG.keyPrefix}:${ip}:${today}`;
    // e.g.  "ratelimit:192.168.1.1:2024-06-05"

    // ── If Redis is down: ALLOW the request (fail open) ──────────────────────
    // WHY fail open (allow) not fail closed (block)?
    // If Redis goes down and we block all requests, your entire API goes offline.
    // Better to allow requests temporarily than to shut down the service.
    if (redisClient.status !== "ready") {
        console.warn(`⚠️  Rate limiter: Redis unavailable — allowing request from ${ip}`);
        return next();
    }

    try {
        // ── Step 1: Increment counter (atomic operation) ──────────────────────
        const currentCount = await redisClient.incr(key);
        // INCR: if key doesn't exist, Redis creates it with value 0 then adds 1.
        // Returns the NEW value after incrementing.

        // ── Step 2: Set expiry only on FIRST request of the day ──────────────
        // WHY only on first (count === 1)?
        // If we set EXPIRE on every request, we'd keep resetting the 24h window.
        // A user could trickle requests and never get blocked.
        // Setting expire once locks the window to exactly 24h from first request.
        if (currentCount === 1) {
            await redisClient.expire(key, RATE_LIMIT_CONFIG.windowSecs);
            console.log(`🆕 Rate limit window started for IP: ${ip} | Key: ${key}`);
        }

        // ── Step 3: Get remaining TTL to show user when limit resets ─────────
        const ttlSeconds = await redisClient.ttl(key);
        const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - currentCount);

        // ── Step 4: Set rate limit headers (standard RFC 6585 headers) ────────
        // WHY headers: Frontend apps and API clients read these to show users
        // "You have X requests remaining" or auto-retry after reset time.
        res.setHeader("X-RateLimit-Limit", RATE_LIMIT_CONFIG.maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining));
        res.setHeader("X-RateLimit-Reset", Math.floor(Date.now() / 1000) + ttlSeconds);
        res.setHeader("X-RateLimit-Window", "24 hours");

        // ── Step 5: Block if over limit ───────────────────────────────────────
        if (currentCount > RATE_LIMIT_CONFIG.maxRequests) {
            // Calculate human-readable reset time
            const resetHours = Math.floor(ttlSeconds / 3600);
            const resetMinutes = Math.floor((ttlSeconds % 3600) / 60);

            console.warn(
                `🚫 Rate limit exceeded | IP: ${ip} | Count: ${currentCount}/${RATE_LIMIT_CONFIG.maxRequests} | Resets in: ${resetHours}h ${resetMinutes}m`
            );

            return res.status(429).json({
                success: false,
                message: "You have exceeded the daily limit for Too Many Requests",
                error: `You have exceeded the daily limit of ${RATE_LIMIT_CONFIG.maxRequests} requests.`,
                limit: RATE_LIMIT_CONFIG.maxRequests,
                used: currentCount,
                remaining: 0,
                resetIn: {
                    seconds: ttlSeconds,
                    human: `${resetHours} hours ${resetMinutes} minutes`,
                },
                retryAfter: `${resetHours}h ${resetMinutes}m`,
                tip: "Your request limit resets every day at midnight (UTC).",
            });
        }

        // ── Step 6: Log progress (optional — remove in production if noisy) ───
        console.log(
            `📊 Rate limit | IP: ${ip} | Used: ${currentCount}/${RATE_LIMIT_CONFIG.maxRequests} | Remaining: ${remaining}`
        );

        // ── Step 7: Allow request ─────────────────────────────────────────────
        next();

    } catch (err) {
        // Redis threw an unexpected error — allow request, log the error
        console.error(`⚠️  Rate limiter error for IP ${ip}:`, err.message);
        next(); // Fail open — don't block users because of our infrastructure issues
    }
};


// Usage: GET /api/v1/rate-limit-status
const getRateLimitStatus = async (req, res) => {
    // console.log("getratelimitn call",req);
    const ip = getClientIP(req);
    const today = getTodayDate();
    const key = `${RATE_LIMIT_CONFIG.keyPrefix}:${ip}:${today}`;

    try {
        // GET doesn't increment — just reads current value
        const countStr = await redisClient.get(key);
        const count = parseInt(countStr) || 0;
        const ttlSeconds = await redisClient.ttl(key);
        const remaining = Math.max(0, RATE_LIMIT_CONFIG.maxRequests - count);
        const resetHours = Math.floor(ttlSeconds / 3600);
        const resetMins = Math.floor((ttlSeconds % 3600) / 60);

        res.status(200).json({
            success: true,
            ip,
            date: today,
            limit: RATE_LIMIT_CONFIG.maxRequests,
            used: count,
            remaining,
            isBlocked: count >= RATE_LIMIT_CONFIG.maxRequests,
            resetIn: {
                seconds: ttlSeconds > 0 ? ttlSeconds : 0,
                human: ttlSeconds > 0 ? `${resetHours}h ${resetMins}m` : "No active window",
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

module.exports = { rateLimiter, getRateLimitStatus };