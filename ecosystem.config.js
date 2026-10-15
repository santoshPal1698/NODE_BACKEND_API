
module.exports = {
  apps: [
    {
      name: "nodejs-api",
      script: "./index.js",
      cwd: __dirname,
      instances: 2,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      kill_timeout: 15000,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
