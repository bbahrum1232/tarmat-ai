import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  ...(process.env.GITHUB_ACTIONS === "true" && {
    basePath: "/tarmat-ai"
  })
};

export default nextConfig;
