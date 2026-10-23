import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { FeatureUpgradeNotice } from "@/components/paywall/feature-upgrade-notice"
import { canAccessVisualRegressionRoute } from "@/lib/visual-regression-access"

export default async function UpgradeBannerPreviewPage() {
  if (!canAccessVisualRegressionRoute(await headers())) notFound()

  return (
    <main className="bg-background text-foreground min-h-svh space-y-8 p-4 sm:p-8">
      <section className="mx-auto max-w-5xl space-y-3">
        <h1 className="text-lg font-semibold">Upgrade banners</h1>
        <p className="text-muted-foreground text-sm">Wide page</p>
        <div className="rounded-xl border">
          <FeatureUpgradeNotice title="Your files, connected">
            Use Google Drive for free. Upgrade to create and edit documents.
          </FeatureUpgradeNotice>
        </div>
      </section>
      <section className="mx-auto w-full max-w-sm space-y-3">
        <h2 className="text-muted-foreground text-sm">Narrow drawer</h2>
        <div className="rounded-xl border">
          <FeatureUpgradeNotice title="Build with the Accelerator">
            Upgrade to unlock organization setup, guided lessons, checklists, and frameworks.
          </FeatureUpgradeNotice>
        </div>
      </section>
    </main>
  )
}
