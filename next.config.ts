import type { NextConfig } from "next";

const repoBase = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/^\/|\/$/g, "");
const basePath = repoBase ? `/${repoBase}` : undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix: basePath,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
