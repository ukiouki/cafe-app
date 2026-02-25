import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // 開発中はOFF（更新の邪魔になるため）
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Turbopackの衝突を避けるための設定
  experimental: {
    // 15/16系でWebpackプラグインを使う場合のおまじない
  },
};

export default withPWA(nextConfig);