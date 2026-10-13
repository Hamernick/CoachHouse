import { PublicMapFooter } from "@/components/public/public-map-index/footer"
import { PublicHomeLandingHeader } from "@/features/build-collect-navigation"
import {
  PricingCallToActionSection,
  PricingFeatureBreakdownIntroSection,
  PricingFeatureMatrixSection,
  PricingHeroSection,
  PricingTierCardsSection,
} from "@/components/public/pricing-surface-sections"
import { cn } from "@/lib/utils"

type PricingSurfaceProps = {
  embedded?: boolean
}

export function PricingSurface({
  embedded = false,
}: PricingSurfaceProps = {}) {
  const isEmbedded = embedded
  const Root = isEmbedded ? "section" : "div"
  const Content = isEmbedded ? "div" : "main"

  return (
    <Root
      data-public-surface="pricing"
      data-public-pricing-embedded={isEmbedded ? "" : undefined}
      aria-labelledby="pricing-heading"
      className={cn(
        "bg-background text-foreground",
        isEmbedded ? "min-h-full" : "min-h-svh"
      )}
    >
      {isEmbedded ? null : (
        <>
          <a href="#pricing-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-3">
            Skip to content
          </a>
          <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
            <PublicHomeLandingHeader activeArea="build" />
          </div>
        </>
      )}
      <Content
        id="pricing-content"
        tabIndex={-1}
        className={cn(
          "mx-auto flex w-full max-w-6xl scroll-mt-28 flex-col gap-12 px-5 pb-16 outline-none sm:gap-16 sm:px-8 lg:px-14 lg:pb-24",
          isEmbedded ? "pt-20 sm:pt-24" : "pt-14 sm:pt-20 lg:pt-24"
        )}
      >
        <PricingHeroSection headingLevel={isEmbedded ? "h2" : "h1"} />
        <PricingTierCardsSection />
        <PricingFeatureBreakdownIntroSection />
        <PricingFeatureMatrixSection />
        <PricingCallToActionSection />
      </Content>
      {isEmbedded ? null : (
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <PublicMapFooter showClaim={false} />
        </div>
      )}
    </Root>
  )
}
