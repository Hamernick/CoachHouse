import Link from "next/link"

import { PublicMapFooter } from "@/components/public/public-map-index/footer"
import { PricingTierCardsSection } from "@/components/public/pricing-surface-sections/pricing-tier-cards-section"
import { Button } from "@/components/ui/button"

import { BuildCoreFeatures, BuildSupportSections } from "./build-public-story"
import { PublicHomeLandingHeader } from "./public-home-landing-header"
import { HomeMediaPlaceholder, HomeStoryLink } from "./public-marketing-primitives"
import { BuildSectionNavigation } from "./build-section-navigation"

export function BuildPublicLanding() {
  return (
    <div data-public-build-landing="" className="min-h-svh bg-background text-foreground">
      <BuildSectionNavigation />
      <a href="#build-content" className="focus-ring sr-only rounded-full bg-background px-5 py-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">Skip to content</a>
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <PublicHomeLandingHeader activeArea="build" />
      </div>
      <main id="build-content" tabIndex={-1} className="mx-auto w-full max-w-[1400px] scroll-mt-32 sm:scroll-mt-24 px-5 outline-none sm:px-8 lg:px-14">
        <section id="workspace" tabIndex={-1} aria-labelledby="build-public-title" className="flex scroll-mt-32 sm:scroll-mt-24 flex-col items-center pt-14 pb-16 text-center outline-none sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
          <h1 id="build-public-title" className="max-w-5xl text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">Workspace for nonprofits.</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">Bring your team, board, documents, and plans together.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
            <Button asChild size="lg" className="min-h-11 rounded-full px-6 shadow-none"><Link href="/build#pricing">See plans</Link></Button>
            <Button asChild size="lg" variant="outline" className="min-h-11 rounded-full px-6 shadow-none"><Link href="/login?redirect=%2Fworkspace">Sign in</Link></Button>
          </div>
        </section>
        <HomeMediaPlaceholder />
        <BuildCoreFeatures />
        <BuildSupportSections />
        <section id="pricing" tabIndex={-1} aria-labelledby="build-pricing-title" className="mx-auto max-w-6xl scroll-mt-32 sm:scroll-mt-24 pb-16 outline-none sm:pb-24">
          <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
            <h2 id="build-pricing-title" className="text-4xl leading-[1.08] font-normal tracking-tight text-balance sm:text-5xl lg:text-6xl">Choose how you build.</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-base leading-snug text-balance sm:text-lg lg:text-xl">Start free, upgrade to build your organization in one place.</p>
          </header>
          <PricingTierCardsSection />
          <div className="mt-6 text-center"><HomeStoryLink href="/pricing">View full comparison</HomeStoryLink></div>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-center text-xs leading-relaxed">Fiscal sponsorship applications are open without an account or paid plan. Approval is separate from your subscription.</p>
        </section>
      </main>
      <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><PublicMapFooter showClaim={false} /></div>
    </div>
  )
}
