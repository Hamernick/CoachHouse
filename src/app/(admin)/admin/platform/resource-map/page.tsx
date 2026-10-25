import type { Metadata } from "next"
import { redirect } from "next/navigation"

import {
  loadResourceMapAdminReviewQueue,
  loadResourceMapAdminReviewRecord,
  ResourceMapAdminReviewPage,
  reviewResourceMapImportRecordFormAction,
  setResourceMapPublicVisibilityFormAction,
} from "@/features/resource-map-admin"
import {
  PublicMapClaimAdminPage,
  loadPublicMapClaimQueue,
  retryPublicMapClaimDeliveryFormAction,
  updatePublicMapClaimStatusFormAction,
} from "@/features/public-map-claims"

export const metadata: Metadata = {
  description: "Review source evidence and publication readiness for public resources.",
  title: "Resource Map Review",
}

function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : null
}

function readPage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(readSearchParam(value) ?? "1", 10)
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : 1
}

export default async function AdminPlatformResourceMapPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const view = readSearchParam(resolvedSearchParams?.view)
  if (view === "claims") {
    const claimPage = readPage(resolvedSearchParams?.page)
    const claimPageSize = 50
    const claimQueue = await loadPublicMapClaimQueue({
      limit: claimPageSize,
      offset: (claimPage - 1) * claimPageSize,
    })
    return (
      <PublicMapClaimAdminPage
        queue={claimQueue}
        selectedClaimId={readSearchParam(resolvedSearchParams?.claim)}
        retryDeliveryAction={retryPublicMapClaimDeliveryFormAction}
        updateStatusAction={updatePublicMapClaimStatusFormAction}
      />
    )
  }
  const page = readPage(resolvedSearchParams?.page)
  const pageSize = 50
  const queue = await loadResourceMapAdminReviewQueue({
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const totalPages = Math.max(Math.ceil(queue.totalImports / pageSize), 1)
  if (queue.totalImports > 0 && page > totalPages) {
    redirect(`/admin/platform/resource-map?page=${totalPages}`)
  }
  const requestedRecordId = readSearchParam(resolvedSearchParams?.record)
  const selectedRecordId = queue.imports.some(
    (record) => record.id === requestedRecordId
  )
    ? requestedRecordId
    : (queue.imports[0]?.id ?? null)

  if (selectedRecordId && selectedRecordId !== requestedRecordId) {
    redirect(
      `/admin/platform/resource-map?page=${page}&record=${encodeURIComponent(selectedRecordId)}`
    )
  }

  const detail = selectedRecordId
    ? await loadResourceMapAdminReviewRecord(selectedRecordId)
    : null

  return (
    <ResourceMapAdminReviewPage
      queue={queue}
      detail={detail}
      actions={{
        reviewImportRecord: reviewResourceMapImportRecordFormAction,
        setPublicVisibility: setResourceMapPublicVisibilityFormAction,
      }}
    />
  )
}
