/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234',
  },
  webpack: (config, { isServer }) => {
    // BPMN.js requires some specific webpack configurations
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }

    // Handle BPMN.js modules
    config.module.rules.push({
      test: /\.bpmn$/,
      use: 'raw-loader',
    });

    return config;
  },
};

module.exports = nextConfig;