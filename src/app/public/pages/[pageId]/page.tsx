import { notFound } from "next/navigation"
import { z } from "zod"
import { GuestWorkspacePage } from "@/features/workspace-sharing/client"

export const metadata = { title: "Shared page", robots: { index: false, follow: false }, referrer: "no-referrer" as const }
export default async function SharedPage({ params, searchParams }: {
  params: Promise<{ pageId: string }>; searchParams: Promise<{ invite?: string | string[] }>
}) {
  const { pageId } = await params
  const { invite } = await searchParams
  if (!z.uuid().safeParse(pageId).success || (invite !== undefined && !z.uuid().safeParse(invite).success)) notFound()
  return <GuestWorkspacePage key={`${pageId}:${invite ?? ""}`} pageId={pageId} invitationId={typeof invite === "string" ? invite : undefined} />
}
