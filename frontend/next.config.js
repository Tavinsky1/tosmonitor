/** @type {import('next').NextConfig} */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  "https://tosmonitor-1.onrender.com";

const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
