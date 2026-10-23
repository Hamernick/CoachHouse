import type { Metadata } from "next"
import type { ReactNode } from "react"
import "@fontsource-variable/inter/wght.css"
import "@fontsource-variable/jetbrains-mono/wght.css"
import "./globals.css"

import { ReactGrabLoader } from "@/components/dev/react-grab-loader"
import { AppProviders } from "@/components/providers/app-providers"
import { AppTelemetry } from "@/components/providers/app-telemetry"
import { getPublicSiteOrigin } from "@/lib/public-site-origin"
import { DEFAULT_SHARE_IMAGE_PATH } from "@/lib/public-share-image-url"
import { getLocale } from "@/lib/locale.server"

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteOrigin()),
  title: {
    default: "Coach House",
    template: "%s · Coach House",
  },
  description:
    "Find, save, and share nonprofits. Build and run your organization with a shared Workspace, guided training, and Executive Coaches.",
  openGraph: {
    type: "website",
    siteName: "Coach House",
    images: [{
      url: new URL(DEFAULT_SHARE_IMAGE_PATH, getPublicSiteOrigin()).href,
      width: 1200,
      height: 630,
      alt: "Coach House — The platform for nonprofits",
      type: "image/png",
    }],
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: "/coach-house-logo-dark.png",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/coach-house-logo-light.png",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/coach-house-logo-dark.png",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const locale = await getLocale()
  const language = locale.split("-")[0] ?? "en"

  return (
    <html lang={language} suppressHydrationWarning>
      <head />
      <body className="bg-background min-h-screen font-sans antialiased">
        <ReactGrabLoader />
        <AppProviders>{children}</AppProviders>
        <AppTelemetry />
      </body>
    </html>
  )
}
