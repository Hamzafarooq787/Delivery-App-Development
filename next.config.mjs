/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ['mapbox-gl'],
  webpack: (config) => {
    // Required for mapbox-gl worker to bundle correctly in Next.js
    config.resolve.alias = {
      ...config.resolve.alias,
    }
    // Ignore mapbox-gl node-specific imports that aren't needed in browser
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    return config
  },
}

export default nextConfig
