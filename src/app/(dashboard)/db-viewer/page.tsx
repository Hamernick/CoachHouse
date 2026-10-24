import type { Metadata } from "next"
import {
  InternalDbViewerPanel,
  loadInternalDbViewerSnapshot,
} from "@/features/internal-db-viewer"

export const metadata: Metadata = {
  title: "Database Viewer",
  description: "Inspect authorized platform data and database records.",
}


type DbViewerPageSearchParams = {
  table?: string | string[]
  limit?: string | string[]
}

export default async function DbViewerPage({
  searchParams,
}: {
  searchParams?: Promise<DbViewerPageSearchParams>
}) {
  const resolved = searchParams ? await searchParams : undefined
  const snapshot = await loadInternalDbViewerSnapshot({
    tableParam: resolved?.table,
    limitParam: resolved?.limit,
  })

  return <InternalDbViewerPanel snapshot={snapshot} />
}
