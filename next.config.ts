import type { NextConfig } from "next"
import { BundleAnalyzerPlugin } from "webpack-bundle-analyzer"

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : undefined
const supabaseImageHosts = Array.from(
  new Set(
    ["vswzhuwjtgzrkxknrmxu.supabase.co", supabaseHost].filter(
      (host): host is string => Boolean(host)
    )
  )
)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/companion/mcp": ["./build/companion-widget/index.html"],
  },
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [
      {
        source: "/resources",
        headers: [
          {
            key: "Permissions-Policy",
            value: "geolocation=(self)",
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: "/map",
        destination: "/resources",
        permanent: true,
      },
      {
        source: "/find",
        destination: "/resources",
        permanent: true,
      },
      {
        source: "/find/:slug",
        destination: "/resources?organization=:slug",
        permanent: true,
      },
    ]
  },
  turbopack: {
    root: __dirname, // ensure Turbopack resolves Next from the repo root
  },
  webpack(config, options) {
    if (process.env.ANALYZE) {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "static",
          reportFilename: options.isServer
            ? "analyze-server.html"
            : "analyze-client.html",
          openAnalyzer: false,
        })
      )
    }
    // Reduce cache serialization warnings in CI by disabling filesystem cache
    if (process.env.CI) {
      config.cache = false
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api.mapbox.com",
        pathname: "/styles/v1/**",
      },
      // Allow images served from Supabase Storage buckets for this project
      ...supabaseImageHosts.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/**",
      })),
    ],
  },
}

export default nextConfig
