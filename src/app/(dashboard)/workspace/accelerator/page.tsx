import type { Metadata } from "next"
import MyOrganizationPageContent from "../../my-organization/_lib/my-organization-page-content"
import type { MyOrganizationSearchParams } from "../../my-organization/_lib/types"

export const metadata: Metadata = {
  title: "Workspace Accelerator",
  description: "Continue your nonprofit accelerator training and assignments.",
}


export default async function WorkspaceAcceleratorPage({
  searchParams,
}: {
  searchParams?: Promise<MyOrganizationSearchParams>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  return MyOrganizationPageContent({
    searchParams: Promise.resolve({
      ...(resolvedSearchParams ?? {}),
      view: "accelerator",
    }),
  })
}
