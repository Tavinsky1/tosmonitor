/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://tosmonitor-1.onrender.com/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;

module.exports = nextConfig;
