/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  // 프로덕션 빌드에서 소스맵 비활성화
  productionBrowserSourceMaps: false,
}

export default nextConfig
