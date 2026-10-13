"use client"

import { getDocumentEditorHref } from "@/lib/workspace/editor-navigation"

import Link from "next/link"
import ExternalLink from "lucide-react/dist/esm/icons/external-link"
import Route from "lucide-react/dist/esm/icons/route"

import { Button } from "@/components/ui/button"
import type { RoadmapRow } from "../types"
import {
  DOCUMENT_ROW_MOBILE_ACTION_BUTTON_CLASSNAME,
  type DocumentRowActionPresentation,
  getDocumentRowActionsClassName,
} from "./document-row-action-styles"

type RoadmapRowActionsProps = {
  row: RoadmapRow
  publicSlug?: string | null
  presentation?: DocumentRowActionPresentation
}

export function RoadmapRowActions({
  row,
  publicSlug,
  presentation = "table",
}: RoadmapRowActionsProps) {
  const mobileButtonClassName =
    presentation === "mobile"
      ? DOCUMENT_ROW_MOBILE_ACTION_BUTTON_CLASSNAME
      : undefined

  return (
    <div className={getDocumentRowActionsClassName(presentation)}>
      <Button
        type="button"
        size="sm"
        variant={presentation === "mobile" ? "ghost" : "secondary"}
        className={mobileButtonClassName}
        asChild
      >
        <Link href={getDocumentEditorHref(row.section.slug)}>
          <Route data-icon="inline-start" aria-hidden />
          Open
        </Link>
      </Button>
      {publicSlug && row.visibility === "public" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={mobileButtonClassName}
          asChild
        >
          <Link
            href={`/${publicSlug}/roadmap#${row.section.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink data-icon="inline-start" aria-hidden />
            Public
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
