import { WorkspacePageDirectory } from "@/features/workspace-sharing/client"

export const metadata = { title: "Shared pages" }
export default async function SharedPages({ searchParams }: {
  searchParams: Promise<{ page?: string; after?: string }>
}) {
  const query = await searchParams
  return <WorkspacePageDirectory pageId={query.page} after={query.after} />
}
