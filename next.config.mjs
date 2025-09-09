/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['canvas', 'sharp'],
  },
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
    responseLimit: '15mb',
  },
}

export default nextConfig
