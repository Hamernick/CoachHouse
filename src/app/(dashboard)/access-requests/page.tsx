import type { Metadata } from "next"
import {
  acceptOrganizationAccessRequestAction,
  declineOrganizationAccessRequestAction,
  listMyOrganizationAccessRequestsAction,
} from "@/app/actions/organization-access"
import { OrganizationAccessRequestsPanel } from "@/features/organization-access"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Access Requests",
  description: "Review requests to join your organization.",
}


export default async function AccessRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
} = {}) {
  const result = await listMyOrganizationAccessRequestsAction()
  if ("error" in result) {
    redirect("/workspace")
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const highlightedRequestId =
    typeof resolvedSearchParams?.request === "string"
      ? resolvedSearchParams.request.trim()
      : null

  return (
    <OrganizationAccessRequestsPanel
      initialRequests={result.requests}
      acceptRequestAction={acceptOrganizationAccessRequestAction}
      declineRequestAction={declineOrganizationAccessRequestAction}
      highlightedRequestId={highlightedRequestId}
    />
  )
}
