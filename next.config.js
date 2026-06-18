/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.mlbstatic.com"
      },
      {
        protocol: "https",
        hostname: "www.cpbl.com.tw"
      },
      {
        protocol: "https",
        hostname: "npb.jp"
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org"
      }
    ]
  }
};

module.exports = nextConfig;
