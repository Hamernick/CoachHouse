"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { resolveEditorReturnDestination } from "@/lib/workspace/editor-navigation"
import { cn } from "@/lib/utils"

export function RoadmapEditorBreadcrumb({ title, className }: { title: string; className?: string }) {
  const searchParams = useSearchParams()
  const parent = resolveEditorReturnDestination(searchParams.get("returnTo"))
  return (
    <Breadcrumb className={cn("mx-auto w-full shrink-0", className)} {...getReactGrabOwnerProps({
      ownerId: "roadmap-editor:breadcrumb", component: "RoadmapEditorBreadcrumb",
      source: "src/components/roadmap/roadmap-editor/components/roadmap-editor-breadcrumb.tsx", slot: "root",
    })}>
      <BreadcrumbList className="gap-1 text-xs sm:gap-1.5">
        <BreadcrumbItem><BreadcrumbLink asChild><Link href={parent.href} className="focus-ring inline-flex min-h-9 items-center rounded-sm sm:min-h-7">{parent.label}</Link></BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="max-w-[min(22rem,70vw)] truncate" title={title}>{title}</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
