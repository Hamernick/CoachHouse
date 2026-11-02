"use client"

import { ParticleButton as Button } from "@/components/ui/particle-ui"

export function PublicWorkspacePageError({ reset }: { reset: () => void }) {
  return <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col items-start justify-center gap-3 px-6 py-12">
    <h1 className="text-xl font-semibold">This page couldn’t load.</h1>
    <p className="text-muted-foreground text-sm" role="status">Try again in a moment.</p>
    <Button size="lg" color="primary" variant="outline" className="min-h-11 rounded-full shadow-none transition-colors motion-reduce:transition-none" onClick={reset}>Try again</Button>
  </main>
}
