import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-ignore: Impede a Vercel de apagar o Chromium no build
    outputFileTracingIncludes: {
      '/api/gerar-pdf': ['./node_modules/@sparticuz/chromium/bin/*'],
    },
  },
};

export default nextConfig;