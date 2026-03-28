import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // @ts-ignore: Essa propriedade é experimental e necessária para o Chromium na Vercel
    outputFileTracingIncludes: {
      '/api/gerar-pdf': ['./node_modules/@sparticuz/chromium/bin/*'],
    },
  },
};

export default nextConfig;