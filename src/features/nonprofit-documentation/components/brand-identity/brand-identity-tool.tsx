"use client"

import Link from "next/link"
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left"
import DownloadIcon from "lucide-react/dist/esm/icons/download"
import RotateCcwIcon from "lucide-react/dist/esm/icons/rotate-ccw"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DocumentationMobileContents } from "../documentation-contents"

import { useBrandIdentityTool } from "../../hooks/use-brand-identity-tool"
import {
  BRAND_IDENTITY_PATH,
  BRAND_IDENTITY_SECTIONS,
} from "../../lib/brand-identity"
import {
  DocumentationJsonLd,
  DocumentationSurface,
} from "../documentation-surface"
import { ApplicationsSection } from "./applications-section"
import { BrandIdentitySidebar } from "./brand-identity-sidebar"
import { FoundationSection } from "./foundation-section"
import { MarksSection } from "./marks-section"
import { PaletteSection } from "./palette-section"
import { TypographySection } from "./typography-section"

export function BrandIdentityTool() {
  const tool = useBrandIdentityTool()

  function moveToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    })
    window.history.replaceState(null, "", `#${id}`)
  }

  return (
    <DocumentationSurface className="print:overflow-visible">
      <DocumentationJsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Nonprofit Brand Identity Builder",
          description:
            "A free, editable nonprofit brand guideline builder with local autosave, accessibility checks, and portable exports.",
          applicationCategory: "DesignApplication",
          operatingSystem: "Any",
          url: `https://coachhouse.app${BRAND_IDENTITY_PATH}`,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          publisher: { "@type": "Organization", name: "Coach House" },
        }}
      />
      <div
        id="documentation-content"
        className="mx-auto w-full max-w-[1040px] px-4 py-6 sm:px-6 sm:py-6 lg:px-8 print:max-w-none print:p-0"
      >
        <DocumentationMobileContents
          items={BRAND_IDENTITY_SECTIONS.map(
            (section) => [section.id, section.label] as const
          )}
          className="mx-auto max-w-[680px] xl:hidden"
        />

        <div className="mx-auto grid max-w-[680px] gap-8 xl:max-w-none xl:grid-cols-[minmax(0,680px)_240px] xl:gap-10 print:block print:max-w-none">
          <article className="min-w-0 font-sans">
            <div className="mb-12 print:mb-8">
              <Link
                href="/documentation"
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs font-medium underline-offset-4 hover:underline print:hidden"
              >
                <ArrowLeftIcon className="size-3.5" aria-hidden />
                Documentation
              </Link>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
                Build your brand
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Create and download your nonprofit’s brand kit.
              </p>
              <div className="mt-5 flex gap-2 print:hidden">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={!tool.ready || !tool.assetsReady}
                    >
                      <RotateCcwIcon aria-hidden />
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Start a fresh brand guide?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the saved text, colors, settings, and
                        uploaded assets from this device. The action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep guide</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void tool.reset()}>
                        Reset guide
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => moveToSection("exports")}
                >
                  <DownloadIcon aria-hidden />
                  Export
                </Button>
              </div>
              <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span role="status" aria-live="polite">
                  {tool.message}
                </span>
                <span>Private to this browser</span>
                <span>No account required</span>
              </div>
            </div>
            <FoundationSection
              draft={tool.draft}
              updateDraft={tool.updateDraft}
            />
            <MarksSection
              draft={tool.draft}
              assets={tool.assets}
              assetUrls={tool.assetUrls}
              updateDraft={tool.updateDraft}
              uploadAsset={tool.uploadAsset}
              deleteAsset={tool.deleteAsset}
              disabled={!tool.assetsReady}
            />
            <PaletteSection draft={tool.draft} updateDraft={tool.updateDraft} />
            <TypographySection
              draft={tool.draft}
              updateDraft={tool.updateDraft}
            />
            <ApplicationsSection
              draft={tool.draft}
              assets={tool.assets}
              assetUrls={tool.assetUrls}
              updateDraft={tool.updateDraft}
              uploadAsset={tool.uploadAsset}
              deleteAsset={tool.deleteAsset}
              disabled={!tool.assetsReady}
            />
          </article>
          <BrandIdentitySidebar
            draft={tool.draft}
            assets={tool.assets}
            ready={tool.ready && tool.assetsReady}
          />
        </div>
      </div>
    </DocumentationSurface>
  )
}
