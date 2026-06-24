import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Pakiety do generowania PDF (Chromium) muszą być traktowane jako zewnętrzne
  // i NIE bundlowane. Dzięki temu działają w runtime serverless na Vercel,
  // a binarka Chromium z @sparticuz/chromium jest dołączana do funkcji.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Wymuś dołączenie binarki Chromium (pliki .br w `bin/`) do bundla funkcji PDF.
  // Tracer plików nie zawsze wykrywa te zasoby ładowane w runtime po ścieżce względnej.
  outputFileTracingIncludes: {
    "/api/pdf": ["./node_modules/.pnpm/@sparticuz+chromium*/**/bin/**"],
    "/api/pdf/from-html": ["./node_modules/.pnpm/@sparticuz+chromium*/**/bin/**"],
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
      // `playwright` jest tylko devDependency i ładowany przez dynamiczny import
      // wyłącznie w trybie dev — externalizujemy, by build produkcyjny go nie wymagał.
      // (puppeteer-core i @sparticuz/chromium obsługuje `serverExternalPackages`.)
      config.externals = config.externals || [];
      config.externals.push({
        playwright: "commonjs playwright",
      });
    }
    return config;
  },
};

export default nextConfig;
