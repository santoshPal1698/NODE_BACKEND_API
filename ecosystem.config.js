module.exports = {
  apps: [
    {
      name: "nodejs-api",
      script: "./index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      kill_timeout: 10000,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
