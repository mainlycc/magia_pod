import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignoruj opcjonalne zależności podczas builda
      config.externals = config.externals || [];
      config.externals.push({
        "puppeteer-core": "commonjs puppeteer-core",
        "@sparticuz/chromium": "commonjs @sparticuz/chromium",
        playwright: "commonjs playwright",
      });
    }
    return config;
  },
};

export default nextConfig;
