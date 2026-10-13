import type { Metadata } from "next"
import type { ReactNode } from "react"
import "@fontsource-variable/inter/wght.css"
import "@fontsource-variable/jetbrains-mono/wght.css"
import "./globals.css"

import { ReactGrabLoader } from "@/components/dev/react-grab-loader"
import { AppProviders } from "@/components/providers/app-providers"
import { AppTelemetry } from "@/components/providers/app-telemetry"
import { getLocale } from "@/lib/locale.server"

export const metadata: Metadata = {
  title: {
    default: "Coach House",
    template: "%s · Coach House",
  },
  description:
    "A course platform built with Next.js, Tailwind CSS, and shadcn/ui. Bootstrapped in step S00.",
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
