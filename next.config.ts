import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Cloud Run 用 Docker イメージで使用
};

export default nextConfig;
