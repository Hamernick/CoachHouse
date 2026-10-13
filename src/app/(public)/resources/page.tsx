import type { Metadata } from "next"
import { PublicHomeResourceExplorer } from "@/components/public/home-resource-explorer"
import type { PublicFindRouteProps } from "@/features/find-map"

export const metadata: Metadata = {
  title: "Resources",
  description: "Find organizations, community resources, and guides on Coach House.",
  alternates: { canonical: "/resources" },
}

export default function ResourcesPage({ searchParams }: PublicFindRouteProps) {
  return <PublicHomeResourceExplorer unframed searchParams={searchParams} />
}
