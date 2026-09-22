"use client"

import Link from "next/link"
import DownloadIcon from "lucide-react/dist/esm/icons/download"
import BookmarkIcon from "lucide-react/dist/esm/icons/bookmark"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { MarketplaceResource } from "../../marketplace-types"
import density from "../documentation-density.module.css"

export function MarketplaceShortlist({
  resources,
  ready,
  persistent = true,
  onClear,
  onDownload,
}: {
  resources: MarketplaceResource[]
  ready: boolean
  persistent?: boolean
  onClear: () => void
  onDownload: () => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11 rounded-full shadow-none"
          disabled={!ready}
        >
          <BookmarkIcon aria-hidden />
          Saved{" "}
          <span data-marketplace-shortlist-count>
            {ready ? resources.length : 0}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent
        className={`${density.surface} flex flex-col gap-0 sm:max-w-md`}
      >
        <SheetHeader>
          <SheetTitle>Saved resources</SheetTitle>
          <SheetDescription>
            {persistent
              ? "Saved in this browser. Export a comparison list to share with your team."
              : "Browser saving is unavailable. Export this list before leaving the tab."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {resources.length ? (
            <ol className="divide-y">
              {resources.map((resource) => (
                <li key={resource.id} className="py-4">
                  <Link
                    href={`/documentation/marketplace/${resource.id}`}
                    className="font-medium hover:underline"
                  >
                    {resource.name}
                  </Link>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {resource.costNote}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <Empty
              className="my-4 rounded-xl"
              title="No saved resources yet"
              description="Use Save on a resource to keep it here."
            />
          )}
        </div>
        {resources.length ? (
          <div className="flex flex-wrap gap-2 border-t p-4">
            <Button onClick={onDownload} className="min-h-11 rounded-full">
              <DownloadIcon aria-hidden />
              Download CSV
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 rounded-full"
              onClick={() => {
                if (
                  window.confirm("Clear all saved resources from this browser?")
                )
                  onClear()
              }}
            >
              Clear saved resources
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
