import { OrganizationPublicationReview, loadOrganizationPublicationReview } from "@/features/organization-launch"

export const dynamic = "force-dynamic"
export const metadata = {
  description: "Review your organization profile before publishing it.", title: "Review public profile", robots: { index: false, follow: false } }

export default async function OrganizationPublicationPreviewPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams
  const review = await loadOrganizationPublicationReview()
  return <OrganizationPublicationReview returnTo={returnTo} review={review} />
}
