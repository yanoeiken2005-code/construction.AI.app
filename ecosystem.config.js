module.exports = {
  apps: [
    {
      name: "construction-ai",
      script: "./node_modules/next/dist/bin/next",
      args: "start",
      cwd: "C:/Users/yanoe/OneDrive/デスクトップ/建設用AIアプリ開発/construction-knowledge-ai",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
