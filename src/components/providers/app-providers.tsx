"use client"

import { useEffect, useState, type ReactNode } from "react"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { ThemeProvider } from "@/components/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { FocusModality } from "@/components/providers/focus-modality"
import { PageHealthReporter } from "@/components/providers/page-health-reporter"

function ClientToaster() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <Toaster position="top-right" richColors />
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NuqsAdapter>
        <FocusModality />
        <ClientToaster />
        <PageHealthReporter />
        {children}
      </NuqsAdapter>
    </ThemeProvider>
  )
}
