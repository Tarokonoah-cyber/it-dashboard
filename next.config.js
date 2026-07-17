/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  outputFileTracingIncludes: {
    "/api/reports/export": [
      "./node_modules/@expo-google-fonts/noto-sans-tc/400Regular/NotoSansTC_400Regular.ttf"
    ]
  },
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
