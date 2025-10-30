/** @type {import('next').NextConfig} */
const backend = (process.env.BACKEND_URL ?? "http://localhost:8081").replace(/\/$/, "");
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    if (isProd) {
      return [];
    }
    return [
      {
        source: "/analytics/:path*",
        destination: `https://airborne.juspay.in/analytics/:path*`,
      },
      {
        source: "/api/:api(releases|file|organisations|applications|users|packages|dashboard|token)/:path*",
        destination: `${backend}/api/:api/:path*`,
      },
      {
        source: "/release/:path*",
        destination: `${backend}/release/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  serverExternalPackages: [],
};

export default nextConfig;
