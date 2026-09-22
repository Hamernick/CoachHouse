"use client"

import type { ReactNode } from "react"
import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function MarketplaceViews({
  view,
  resources,
  people,
}: {
  view: "resources" | "people"
  resources: ReactNode
  people: ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const changeView = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "people") params.set("view", "people")
    else params.delete("view")
    startTransition(() =>
      router.push(
        `/documentation/marketplace${params.size ? `?${params}` : ""}`,
        { scroll: false }
      )
    )
  }
  return (
    <Tabs value={view} onValueChange={changeView} className="gap-0">
      <div className="flex flex-wrap items-center gap-4 pb-4">
        <TabsList
          className="rounded-full p-1 group-data-[orientation=horizontal]/tabs:h-11"
          aria-label="Marketplace views"
        >
          <TabsTrigger value="resources" className="min-h-9 rounded-full px-4">
            Tools & resources
          </TabsTrigger>
          <TabsTrigger value="people" className="min-h-9 rounded-full px-4">
            People
          </TabsTrigger>
        </TabsList>
        <span role="status" className="text-muted-foreground text-xs">
          {pending ? "Loading view…" : ""}
        </span>
      </div>
      <TabsContent value="resources">{resources}</TabsContent>
      <TabsContent value="people">{people}</TabsContent>
    </Tabs>
  )
}
