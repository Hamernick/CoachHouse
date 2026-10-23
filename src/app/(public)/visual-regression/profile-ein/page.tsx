import { headers } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"

import { OrganizationDetailIdentitySection } from "@/components/public/public-map-index/organization-detail-shell-sections"
import { PublicMapResourceIdentitySection } from "@/components/public/public-map-index/resource-detail-primary-sections"
import { fetchPublicMapOrganizations } from "@/lib/queries/public-map-index"
import { fetchPublicResourceProfile } from "@/lib/queries/public-resource-profile"
import { canAccessVisualRegressionRoute } from "@/lib/visual-regression-access"

export default async function ProfileEinPreviewPage() {
  if (!canAccessVisualRegressionRoute(await headers())) notFound()
  const [organizations, nonprofit] = await Promise.all([
    fetchPublicMapOrganizations(), fetchPublicResourceProfile("146024895"),
  ])
  const organization = organizations.find((item) => item.publicSlug === "coachhousesolutionsgroup")
  return (
    <main className="bg-background text-foreground mx-auto min-h-svh max-w-3xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Profile EIN display</h1>
      {organization ? <section className="rounded-2xl border p-6">
        <p className="text-muted-foreground mb-5 text-sm">Platform organization</p>
        <OrganizationDetailIdentitySection organization={organization} profileImageSrc={organization.logoUrl} profileInitials="CH" location={[organization.city, organization.state].filter(Boolean).join(", ")} />
        <Link className="mt-6 inline-block text-sm underline" href="/coachhousesolutionsgroup">Open full profile</Link>
      </section> : null}
      {nonprofit ? <section className="rounded-2xl border p-6">
        <p className="text-muted-foreground mb-5 text-sm">IRS directory organization</p>
        <PublicMapResourceIdentitySection item={nonprofit} />
        <Link className="mt-6 inline-block text-sm underline" href="/find/resources/146024895">Open full profile</Link>
      </section> : null}
    </main>
  )
}
