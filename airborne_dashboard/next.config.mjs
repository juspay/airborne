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
  },
};

export default nextConfig;
