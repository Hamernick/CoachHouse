import type { ComponentType } from "react"
import CircleDollarSignIcon from "lucide-react/dist/esm/icons/circle-dollar-sign"
import HammerIcon from "lucide-react/dist/esm/icons/hammer"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import UsersIcon from "lucide-react/dist/esm/icons/users"

import { FORMATION_STATUS_OPTIONS } from "@/lib/organization/formation-status"
import { RESERVED_PUBLIC_ORGANIZATION_SLUGS } from "@/lib/organization/reserved-public-slugs"
import type { FormationStatus, IntentFocus, Step } from "./types"

export const FORMATION_OPTIONS: Array<{
  value: FormationStatus
  label: string
  description: string
}> = FORMATION_STATUS_OPTIONS

export const BUILDER_STEPS: Step[] = [
  {
    id: "intent",
    title: "What would you like to do?",
    description:
      "Build your organization or connect with nonprofits doing work you care about.",
  },
  {
    id: "pricing",
    title: "Choose your starting point",
    description:
      "Start free with Individual, or choose a plan with team access and guided Accelerator lessons.",
  },
  {
    id: "org",
    title: "Name your organization",
    description:
      "Add your organization’s name, link, and formation status. You can update these later.",
  },
  {
    id: "account",
    title: "Set up your account",
    description: "Add your name and choose a username. Everything else is optional.",
  },
  {
    id: "community",
    title: "Connect with the community",
    description:
      "Ask questions and meet other nonprofit builders. Join now or continue without joining.",
  },
]

export const MEMBER_STEPS: Step[] = [
  {
    id: "intent",
    title: "What would you like to do?",
    description:
      "Build your organization or connect with nonprofits doing work you care about.",
  },
  {
    id: "account",
    title: "Set up your account",
    description:
      "Add your name and choose a username. Everything else is optional.",
  },
  {
    id: "community",
    title: "Connect with the community",
    description:
      "Meet people working with nonprofits. Join now or continue without joining.",
  },
]

export const STEPS = BUILDER_STEPS

export function resolveOnboardingSteps(intentFocus: IntentFocus | "") {
  return intentFocus === "find" ||
    intentFocus === "fund" ||
    intentFocus === "support"
    ? MEMBER_STEPS
    : BUILDER_STEPS
}

export type IntentOption = {
  value: IntentFocus
  label: string
  description: string
  available: boolean
  icon: ComponentType<{ className?: string }>
}

export const INTENT_OPTIONS: IntentOption[] = [
  {
    value: "build",
    label: "Build a nonprofit",
    description: "Set up your organization, roadmap, and operating foundation.",
    available: true,
    icon: HammerIcon,
  },
  {
    value: "find",
    label: "Find nonprofits",
    description: "Discover organizations, initiatives, and partners.",
    available: true,
    icon: SearchIcon,
  },
  {
    value: "fund",
    label: "Fund nonprofits",
    description: "Connect with nonprofits you want to support.",
    available: true,
    icon: CircleDollarSignIcon,
  },
  {
    value: "support",
    label: "Support teams",
    description: "Connect with nonprofit teams and share your expertise.",
    available: true,
    icon: UsersIcon,
  },
]

export const RESERVED_SLUGS = RESERVED_PUBLIC_ORGANIZATION_SLUGS

export const DRAFT_VALUE_KEYS = [
  "intentFocus",
  "roleInterest",
  "orgName",
  "orgSlug",
  "firstName",
  "lastName",
  "personHandle",
  "phone",
  "publicEmail",
  "title",
  "linkedin",
] as const

export const DRAFT_FLAG_KEYS = ["optInUpdates", "newsletterOptIn"] as const
