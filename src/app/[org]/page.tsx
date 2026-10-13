import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { PublicProfilePage } from "@/features/public-profiles"
import { PublicHomeResourceExplorer } from "@/components/public/home-resource-explorer"
import { fetchPublicMapViewerState } from "@/features/find-map"
import { buildFindOrganizationHref } from "@/lib/find/routes"
import { buildPublicProfileMetadata } from "@/lib/public-profile-metadata"
import {
  fetchPublicProfileByHandle,
} from "@/lib/queries/public-profile"

export const revalidate = 300

type PublicHandlePageProps = {
  params: Promise<{ org: string }>
  searchParams?: Promise<{ program?: string | string[] }>
}

export async function generateMetadata({
  params,
}: PublicHandlePageProps): Promise<Metadata> {
  const { org } = await params
  const profile = await fetchPublicProfileByHandle(org)
  return buildPublicProfileMetadata(profile, org)
}

export default async function PublicHandlePage({
  params,
  searchParams,
}: PublicHandlePageProps) {
  const { org } = await params
  const slug = String(org).trim()
  if (!slug) return notFound()

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const programParam = resolvedSearchParams?.program
  const selectedProgramId = (() => {
    if (typeof programParam === "string") return programParam.trim() || null
    if (Array.isArray(programParam)) {
      const first = programParam[0]
      return typeof first === "string" ? first.trim() || null : null
    }
    return null
  })()

  if (selectedProgramId) {
    redirect(
      buildFindOrganizationHref(
        slug,
        new URLSearchParams({ program: selectedProgramId })
      )
    )
  }

  const profile = await fetchPublicProfileByHandle(slug)
  if (profile?.kind === "organization" && profile.organization) {
    return <PublicHomeResourceExplorer searchParams={searchParams} initialOrganization={profile.organization} />
  }
  if (profile) {
    const { viewer } = await fetchPublicMapViewerState()
    return <PublicProfilePage profile={profile} viewer={viewer} />
  }

  notFound()
}
