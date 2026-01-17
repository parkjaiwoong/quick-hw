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
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = false
    }
    return config
  },
  turbopack: {},
}

export default nextConfig
