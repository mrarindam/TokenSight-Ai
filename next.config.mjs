/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production"

const nextConfig = {
  images: {
    // Allow external images from Bags API and common token image hosts
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  ...(isProduction
    ? {
        compiler: {
          removeConsole: {
            exclude: ["error", "warn"], // keep only errors and warnings
          },
        },
      }
    : {}),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
