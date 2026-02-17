/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverSourceMaps: false,
  },
  images: {
    unoptimized: true,
  },
  // 프로덕션 빌드에서 소스맵 비활성화
  productionBrowserSourceMaps: false,
  // CORS: Android WebView 등에서 프런트(동일 도메인) 요청 허용
  async headers() {
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://your-app.vercel.app"
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS,PATCH" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, Accept" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ]
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = false
    }
    return config
  },
  turbopack: {},
}

export default nextConfig
