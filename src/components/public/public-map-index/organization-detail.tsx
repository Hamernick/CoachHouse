"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { resolveFormationStatusOption } from "@/lib/organization/formation-status"
import type { PublicMapOrganization } from "@/lib/queries/public-map-index"

import {
  buildActionLinks,
  buildContactRows,
  buildInitials,
  buildResourceLinks,
  buildStoryFields,
  formatAddressLines,
  formatLocation,
  normalizeImageSrc,
  normalizeHref,
  normalizeText,
  resolveAboutText,
  resolveBrandKitDownloadHref,
  truncateAtWordBoundary,
} from "./organization-detail-helpers"
import {
  OrganizationDetailAddressSection,
  OrganizationDetailBrandKitSection,
  OrganizationDetailContactSection,
  OrganizationDetailFormationSection,
  OrganizationDetailOriginSection,
  OrganizationDetailActivitiesSection,
} from "./organization-detail-sections"
import { OrganizationDetailResourceLinksSection } from "./organization-detail-resource-links-section"
import {
  OrganizationDetailAboutSection,
  OrganizationDetailActionLinks,
  OrganizationDetailIdentitySection,
} from "./organization-detail-shell-sections"
import { PUBLIC_MAP_DETAIL_PROFILE_CLASSNAME } from "./sidebar-theme"

type PublicMapOrganizationDetailProps = {
  organization: PublicMapOrganization
  compact?: boolean
  standalone?: boolean
}

export function PublicMapOrganizationDetail({
  organization,
  compact = false,
  standalone = false,
}: PublicMapOrganizationDetailProps) {
  const [aboutExpanded, setAboutExpanded] = useState(false)

  const profileImageSrc =
    normalizeImageSrc(organization.logoUrl) ??
    normalizeImageSrc(organization.headerUrl)
  const formationStatus = resolveFormationStatusOption(
    organization.formationStatus
  )
  const profileInitials = buildInitials(organization.name)
  const location = formatLocation(organization)
  const storyFields = buildStoryFields(organization)
  const contactRows = buildContactRows(organization)
  const addressLines = formatAddressLines(organization)
  const resourceHref =
    normalizeHref(organization.locationUrl) ??
    normalizeHref(organization.website)
  const aboutText = resolveAboutText(organization)
  const aboutNeedsToggle = aboutText.length > 280
  const aboutCopy = aboutExpanded
    ? aboutText
    : truncateAtWordBoundary(aboutText, 280)
  const actionLinks = buildActionLinks(organization)
  const resources = buildResourceLinks(organization)
  const activities =
    organization.activityLinks.length > 0
      ? organization.activityLinks
      : organization.programs
  const brandKitDownloadHref = resolveBrandKitDownloadHref(organization)

  return (
    <div
      data-public-map-profile="organization"
      className={cn(
        PUBLIC_MAP_DETAIL_PROFILE_CLASSNAME,
        "[&_*]:shadow-none",
        compact ? "mb-[max(env(safe-area-inset-bottom),0.75rem)]" : "mb-3"
      )}
    >
      <OrganizationDetailIdentitySection
        headingLevel={standalone ? "h1" : "h2"}
        organization={organization}
        profileImageSrc={profileImageSrc}
        profileInitials={profileInitials}
        location={location}
      />

      <OrganizationDetailActionLinks actionLinks={actionLinks} />

      <OrganizationDetailAboutSection
        isOnlineOnly={organization.isOnlineOnly}
        primaryGroup={organization.primaryGroup}
        aboutCopy={aboutCopy}
        aboutExpanded={aboutExpanded}
        aboutNeedsToggle={aboutNeedsToggle}
        onToggle={() => setAboutExpanded((previous) => !previous)}
      />

      <OrganizationDetailActivitiesSection activities={activities} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 [&>section]:min-w-0 [&>section:only-child]:col-span-2">
        <OrganizationDetailFormationSection formationStatus={formationStatus} />
        <OrganizationDetailBrandKitSection
          organization={organization}
          brandKitDownloadHref={brandKitDownloadHref}
        />
      </div>


      <OrganizationDetailOriginSection storyFields={storyFields} />

      <OrganizationDetailContactSection contactRows={contactRows} />

      <OrganizationDetailAddressSection
        addressLines={addressLines}
        isOnlineOnly={organization.isOnlineOnly}
        resourceHref={resourceHref}
      />

      <OrganizationDetailResourceLinksSection resources={resources} />
    </div>
  )
}
