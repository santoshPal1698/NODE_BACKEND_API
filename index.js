// index.js
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const app = express();
const bodyParser = require("body-parser");
require("dotenv").config();
const dotenvFlow = require("dotenv-flow");
dotenvFlow.config();
require("./src/db/clusterdb_server.js").connectDB();
require("./src/Auth2Fa/Auth_Config/passportConfig.js");

const cutomerRouter = require("./src/routes/customer_view");
const studentRouter = require("./src/routes/student");
const portfolioRouter = require("./src/routes/myportfolio_View");
const GenAIRouter = require("./src/GenrativeAi-Features/Routes/ai.routes");
const RegisterRouter = require("./src/routes/Register");
const EmployeeRouter = require("./src/routes/employee_view");
const aut2FaRouter = require("./src/Auth2Fa/Routes/auth2fa_view");

const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const csrf = require("csurf");

// ─── Redis client (ioredis singleton) ───────────────────────────────────────
const redisClient = require("./src/config/redis");
const { rateLimiter, getRateLimitStatus } = require("./src/config/rateLimiter");

// ─── Body / cookie parsers ───────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());

// app.use(
//   cors({
//     origin:"https://santosh-pal.netlify.app/",
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
//   })
// );

// ─── Session + Passport ──────────────────────────────────────────────────────
// When behind a reverse-proxy (NGINX) enable trust proxy so Express can
// correctly read X-Forwarded-* headers and produce secure cookies.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // trust first proxy
}

const RedisStore = require('connect-redis')(session);

app.use(
  session({
    store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
    secret: process.env.SESSION_SECRET || "SptechDEVE",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // send cookie over HTTPS only in prod
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ─── CSRF ────────────────────────────────────────────────────────────────────
const csrfProtection = csrf();

// ─── Swagger ─────────────────────────────────────────────────────────────────
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");
const swaggerOptions = {
  swaggerOptions: { validatorUrl: null },
};

// ─── Redis health-check endpoint ─────────────────────────────────────────────
// Hit GET /health to see if Redis + server are alive
app.get("/health", async (req, res) => {
  try {
    const redisPing = await redisClient.ping(); // returns "PONG"
    res.status(200).json({
      status: "ok",
      redis: redisPing === "PONG" ? "connected" : "unreachable",
      uptime: `${Math.floor(process.uptime())}s`,
    });
  } catch (err) {
    res.status(500).json({ status: "error", redis: "unreachable", error: err.message });
  }
});

// ─── Cache admin endpoint (optional, protect in production) ──────────────────
// Hit DELETE /cache/portfolio to manually flush portfolio cache keys
app.delete("/cache/portfolio", async (req, res) => {
  try {
    // Find all keys matching portfolio:* pattern and delete them
    const keys = await redisClient.keys("portfolio:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    res.status(200).json({
      success: true,
      message: `Flushed ${keys.length} cache key(s)`,
      keys,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/v1/rate-limit-status", getRateLimitStatus);
// WHY NOT apply to /health, /cache/portfolio, swagger:
//  - /health: monitoring tools ping this every 30s — would hit limit instantly
//  - /cache/portfolio: admin tool — should always work
//  - swagger: documentation page — not an API call
app.use("/api/v1", rateLimiter);

// ─── App routes ──────────────────────────────────────────────────────────────
app.use(
  "/api/v1",
  RegisterRouter,
  aut2FaRouter,
  portfolioRouter,
  GenAIRouter,
  cutomerRouter,
  EmployeeRouter,
  studentRouter
);

// ─── Swagger UI ──────────────────────────────────────────────────────────────
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// ─── Start server ────────────────────────────────────────────────────────────
const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`✅ Server running in ${process.env.ENV} mode`);
  console.log(`🌐Api_Base URL: ${process.env.APIBASEURL} ${port}`);
  console.log(`🚀 Port: ${port}`);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
// Stop accepting requests and close external connections before PM2 restarts.

let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n${signal} received — shutting down gracefully...");

  try {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  } catch (err) {
    console.error("HTTP server shutdown error:", err.message);
    process.exitCode = 1;
  }

  try {
    if (redisClient.status === "ready") {
      await redisClient.quit();
    } else {
      redisClient.disconnect();
    }
    console.log("✅ Redis disconnected");
  } catch (err) {
    console.error("Redis shutdown error:", err.message);
    process.exitCode = 1;
  }

  try {
    await mongoose.disconnect();
    console.log("✅ MongoDB disconnected");
  } catch (err) {
    console.error("MongoDB shutdown error:", err.message);
    process.exitCode = 1;
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));