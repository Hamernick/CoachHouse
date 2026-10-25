import type { Metadata } from "next"
import {
  buildPrototypeLabInput,
  PrototypeLabPanel,
} from "@/features/prototype-lab"
import {
  ActivationMonitorPanel,
  getActivationMonitorPageInput,
} from "@/features/activation-monitor"
import { FiscalSponsorshipPanel } from "@/features/fiscal-sponsorship"
import {
  getPageHealthMonitorPageInput,
  PageHealthMonitorPanel,
} from "@/features/page-health-monitor"
import {
  getUserJourneyAtlasPageInput,
  UserJourneyAtlasPanel,
} from "@/features/user-journey-atlas"
import { requireAdmin } from "@/lib/admin/auth"

export const metadata: Metadata = {
  title: "Platform Tools",
  description: "Review operational tools, fiscal sponsorship, and platform health.",
}


function readSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : null
}

export default async function AdminPlatformPrototypesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const input = buildPrototypeLabInput({
    selectedEntryId: readSearchParam(resolvedSearchParams?.entry),
    selectedProjectId: readSearchParam(resolvedSearchParams?.project),
  })
  const [
    userJourneyAtlasInput,
    activationMonitorInput,
    pageHealthMonitorInput,
  ] = await Promise.all([
    input.selectedEntry.id === "user-journey-atlas"
      ? getUserJourneyAtlasPageInput()
      : Promise.resolve(null),
    input.selectedEntry.id === "activation-monitor"
      ? getActivationMonitorPageInput()
      : Promise.resolve(null),
    input.selectedEntry.id === "page-health-monitor"
      ? getPageHealthMonitorPageInput()
      : Promise.resolve(null),
  ])

  return (
    <PrototypeLabPanel
      input={input}
      activationMonitorPrototype={
        activationMonitorInput ? (
          <ActivationMonitorPanel input={activationMonitorInput} />
        ) : undefined
      }
      fiscalSponsorshipPrototype={
        <FiscalSponsorshipPanel input={{ id: "fiscal-sponsorship-flow" }} />
      }
      pageHealthMonitorPrototype={
        pageHealthMonitorInput ? (
          <PageHealthMonitorPanel input={pageHealthMonitorInput} />
        ) : undefined
      }
      userJourneyAtlasPrototype={
        userJourneyAtlasInput ? (
          <UserJourneyAtlasPanel input={userJourneyAtlasInput} />
        ) : undefined
      }
    />
  )
}
