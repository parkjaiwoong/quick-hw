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
  // CORS: API는 middleware.ts에서 처리(OPTIONS·다중 origin). 여기는 페이지 등 보조용.
  async headers() {
    const allowedOrigin =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://quick-hw.vercel.app")
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
