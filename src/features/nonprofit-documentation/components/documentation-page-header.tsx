"use client"

import Image from "next/image"
import type { ReactNode } from "react"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "@/components/public/public-map-index/sidebar-theme"
import density from "./documentation-density.module.css"
import { getDocumentationArtwork } from "./documentation-artwork"

export function DocumentationPageHeader({
  eyebrow,
  title,
  description,
  artwork,
  artworkKind = "background",
  children,
}: {
  eyebrow: string
  title: string
  description: string
  artwork: string
  artworkKind?: "background" | "logo"
  children?: ReactNode
}) {
  const artworkImage = getDocumentationArtwork(artwork)
  const logoWidth = Math.min(
    artworkImage.width,
    artworkImage.width / artworkImage.height < 1.5 ? 64 : 256
  )
  const getSlotOwnerProps = (slot: string) =>
    getReactGrabOwnerProps({
      ownerId:
        slot === "article-header"
          ? "documentation:page-header"
          : `documentation:${artwork}:${slot}`,
      component: "DocumentationPageHeader",
      source:
        "src/features/nonprofit-documentation/components/documentation-page-header.tsx",
      canonicalOwnerSource:
        "src/features/nonprofit-documentation/components/documentation-page-header.tsx",
      canonicalOwnerReason:
        "Owns this header element and its class assembly; text comes from the page props.",
      slot,
      tokenSource:
        slot === "eyebrow" && artworkKind === "background"
          ? "src/components/public/public-map-index/sidebar-theme.ts"
          : "src/app/globals.css",
      notes:
        slot === "eyebrow"
          ? "Small context label above the title. Marketplace category text is supplied by marketplace-resource-page.tsx."
          : undefined,
    })
  return (
    <header
      className="mt-2 mb-4 text-center"
      {...getSlotOwnerProps("article-header")}
    >
      <div className="bg-muted/20 rounded-2xl border p-2 print:border-0 print:bg-transparent print:p-0">
        {artworkKind === "logo" ? (
          <div className="px-5 py-6 sm:px-8">
            <div className="mx-auto mb-5 flex w-fit max-w-full items-center rounded-xl bg-white p-4 print:hidden">
              <Image
                src={artworkImage}
                alt=""
                width={logoWidth}
                height={Math.round(
                  (logoWidth * artworkImage.height) / artworkImage.width
                )}
                className="h-auto max-w-full object-contain"
                sizes="256px"
                preload
              />
            </div>
            <div className={density.heading}>
              <p
                className="text-muted-foreground text-xs"
                {...getSlotOwnerProps("eyebrow")}
              >
                {eyebrow}
              </p>
              <h1
                className="text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2.125rem]"
                {...getSlotOwnerProps("title")}
              >
                {title}
              </h1>
              <p
                className="mx-auto max-w-2xl text-[15px] text-pretty sm:text-base"
                {...getSlotOwnerProps("description")}
              >
                {description}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative isolate grid min-h-60 place-items-center overflow-hidden rounded-lg px-5 py-8 sm:aspect-[3/1] sm:min-h-64 sm:px-8 print:block print:aspect-auto print:min-h-0 print:rounded-none print:p-0">
            <Image
              src={artworkImage}
              alt=""
              fill
              className="rounded-lg object-cover print:hidden"
              sizes="(min-width: 1280px) 1100px, (min-width: 768px) 75vw, 100vw"
              preload
            />
            <div
              className={`${density.heading} relative w-fit max-w-full min-w-0 [overflow-wrap:anywhere] text-white print:w-full print:text-black`}
            >
              <p
                className={`${PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME} mx-auto w-fit rounded-full px-3 py-1 text-xs font-medium print:rounded-none print:border-0 print:!bg-transparent print:p-0 print:text-black print:backdrop-blur-none`}
                {...getSlotOwnerProps("eyebrow")}
              >
                {eyebrow}
              </p>
              <h1
                className="mx-auto max-w-3xl text-[1.75rem] font-semibold tracking-tight text-balance sm:text-[2.125rem]"
                {...getSlotOwnerProps("title")}
              >
                {title}
              </h1>
              <p
                className="mx-auto max-w-2xl text-[15px] text-pretty sm:text-base"
                {...getSlotOwnerProps("description")}
              >
                {description}
              </p>
            </div>
          </div>
        )}
      </div>
      {children ? <div className="mt-2">{children}</div> : null}
    </header>
  )
}
