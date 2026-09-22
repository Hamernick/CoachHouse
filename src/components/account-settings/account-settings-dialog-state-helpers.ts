import { refreshPublicProfileAction } from "@/actions/public-profile-settings"
import { saveAccountEmailPreferencesAction } from "@/actions/account-email-preferences"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { AccountDeletionPreflight } from "@/lib/account-deletion/types"
import type { Database } from "@/lib/supabase"

type AccountSettingsSupabaseClient = SupabaseClient<Database, "public">

type SaveProfileSettingsArgs = {
  supabase: AccountSettingsSupabaseClient
  userId: string
  firstName: string
  lastName: string
  title: string
  company: string
  contact: string
  about: string
  phone: string
  initialFirstName: string
  initialLastName: string
  initialTitle: string
  initialCompany: string
  initialContact: string
  initialAbout: string
  initialPhone: string
}

type SaveProfileSettingsResult = {
  firstName: string
  lastName: string
  title: string
  company: string
  contact: string
  about: string
  initialFirstName: string
  initialLastName: string
  initialTitle: string
  initialCompany: string
  initialContact: string
  initialAbout: string
  initialPhone: string
}

type SaveCommunicationPreferencesArgs = {
  supabase: AccountSettingsSupabaseClient
  marketingOptIn: boolean
  newsletterOptIn: boolean
  initialMarketingOptIn: boolean
  initialNewsletterOptIn: boolean
}

type SaveCommunicationPreferencesResult = {
  initialMarketingOptIn: boolean
  initialNewsletterOptIn: boolean
}

type DeleteAccountResult =
  | { ok: true }
  | {
      ok: false
      sessionExpired: boolean
      message: string
    }

type DeleteAccountPreflightResult =
  | { ok: true; preflight: AccountDeletionPreflight }
  | {
      ok: false
      sessionExpired: boolean
      message: string
    }

const DEFAULT_DELETE_ACCOUNT_ERROR = "Unable to delete account."
const SESSION_EXPIRED_DELETE_ACCOUNT_ERROR =
  "Session expired. Sign in again, then retry account deletion."
const SESSION_ERROR_FRAGMENTS = [
  "invalid refresh token",
  "refresh token not found",
  "auth session",
]

export function resolveErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message
  }
  return fallbackMessage
}

export function isMobileSettingsViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
  )
}

export async function saveProfileSettings({
  supabase,
  userId,
  firstName,
  lastName,
  title,
  company,
  contact,
  about,
  phone,
  initialFirstName,
  initialLastName,
  initialTitle,
  initialCompany,
  initialContact,
  initialAbout,
  initialPhone,
}: SaveProfileSettingsArgs): Promise<SaveProfileSettingsResult> {
  const trimmedFirstName = firstName.trim()
  const trimmedLastName = lastName.trim()
  const trimmedTitle = title.trim()
  const trimmedCompany = company.trim()
  const trimmedContact = contact.trim()
  const trimmedAbout = about.trim()
  const initialFullName = [initialFirstName, initialLastName]
    .filter(Boolean)
    .join(" ")
  const nextFullName = [trimmedFirstName, trimmedLastName]
    .filter(Boolean)
    .join(" ")

  let nextFirstName = firstName
  let nextLastName = lastName
  let nextTitle = title
  let nextCompany = company
  let nextContact = contact
  let nextAbout = about
  let nextInitialFirstName = initialFirstName
  let nextInitialLastName = initialLastName
  let nextInitialTitle = initialTitle
  let nextInitialCompany = initialCompany
  let nextInitialContact = initialContact
  let nextInitialAbout = initialAbout
  let nextInitialPhone = initialPhone

  if (
    initialFullName !== nextFullName ||
    initialTitle !== trimmedTitle ||
    initialCompany !== trimmedCompany ||
    initialContact !== trimmedContact ||
    initialAbout !== trimmedAbout
  ) {
    if (
      !nextFullName ||
      nextFullName.length > 80 ||
      trimmedTitle.length > 120
    ) {
      throw new Error(
        "Enter a name of 1–80 characters and a role of at most 120 characters."
      )
    }
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: nextFullName || null,
        headline: trimmedTitle || null,
        company: trimmedCompany || null,
        contact: trimmedContact || null,
        about: trimmedAbout || null,
      },
      { onConflict: "id" }
    )
    if (profileError) {
      throw profileError
    }

    await refreshPublicProfileAction()
    nextTitle = trimmedTitle
    nextCompany = trimmedCompany
    nextContact = trimmedContact
    nextAbout = trimmedAbout
    nextInitialTitle = trimmedTitle
    nextInitialCompany = trimmedCompany
    nextInitialContact = trimmedContact
    nextInitialAbout = trimmedAbout
  }

  if (initialFullName !== nextFullName) {
    const { error: fullNameMetadataError } = await supabase.auth.updateUser({
      data: {
        full_name: nextFullName || null,
        first_name: trimmedFirstName || null,
        last_name: trimmedLastName || null,
      },
    })
    if (fullNameMetadataError) {
      throw fullNameMetadataError
    }

    nextInitialFirstName = trimmedFirstName
    nextInitialLastName = trimmedLastName
    nextFirstName = trimmedFirstName
    nextLastName = trimmedLastName
  }

  if (phone !== initialPhone) {
    const { error: phoneError } = await supabase.auth.updateUser({
      data: { phone },
    })
    if (phoneError) {
      throw phoneError
    }
    nextInitialPhone = phone
  }

  return {
    firstName: nextFirstName,
    lastName: nextLastName,
    title: nextTitle,
    company: nextCompany,
    contact: nextContact,
    about: nextAbout,
    initialFirstName: nextInitialFirstName,
    initialLastName: nextInitialLastName,
    initialTitle: nextInitialTitle,
    initialCompany: nextInitialCompany,
    initialContact: nextInitialContact,
    initialAbout: nextInitialAbout,
    initialPhone: nextInitialPhone,
  }
}

export async function saveCommunicationPreferences({
  marketingOptIn,
  newsletterOptIn,
  initialMarketingOptIn,
  initialNewsletterOptIn,
}: SaveCommunicationPreferencesArgs): Promise<SaveCommunicationPreferencesResult> {
  const metadata: Record<string, boolean> = {}
  if (marketingOptIn !== initialMarketingOptIn) {
    metadata.marketing_opt_in = marketingOptIn
  }
  if (newsletterOptIn !== initialNewsletterOptIn) {
    metadata.newsletter_opt_in = newsletterOptIn
  }

  if (Object.keys(metadata).length === 0) {
    return {
      initialMarketingOptIn,
      initialNewsletterOptIn,
    }
  }

  const result = await saveAccountEmailPreferencesAction({
    marketingOptIn:
      marketingOptIn !== initialMarketingOptIn ? marketingOptIn : null,
    newsletterOptIn:
      newsletterOptIn !== initialNewsletterOptIn ? newsletterOptIn : null,
  })
  if (!result.ok) throw new Error(result.error)

  return {
    initialMarketingOptIn: marketingOptIn,
    initialNewsletterOptIn: newsletterOptIn,
  }
}

export async function requestDeleteAccount(): Promise<DeleteAccountResult> {
  try {
    const response = await fetch("/api/account/delete", { method: "DELETE" })
    if (response.ok) {
      return { ok: true }
    }

    const payload = await response.json().catch(() => ({}))
    const message =
      typeof payload?.error === "string" && payload.error.length > 0
        ? payload.error
        : DEFAULT_DELETE_ACCOUNT_ERROR
    const normalizedMessage = message.toLowerCase()
    const sessionExpired =
      response.status === 401 ||
      SESSION_ERROR_FRAGMENTS.some((fragment) =>
        normalizedMessage.includes(fragment)
      )

    if (sessionExpired) {
      return {
        ok: false,
        sessionExpired: true,
        message: SESSION_EXPIRED_DELETE_ACCOUNT_ERROR,
      }
    }

    return {
      ok: false,
      sessionExpired: false,
      message,
    }
  } catch {
    return {
      ok: false,
      sessionExpired: false,
      message: DEFAULT_DELETE_ACCOUNT_ERROR,
    }
  }
}

export async function requestDeleteAccountPreflight(): Promise<DeleteAccountPreflightResult> {
  try {
    const response = await fetch("/api/account/delete/preflight", {
      method: "GET",
      cache: "no-store",
    })
    const payload = await response.json().catch(() => ({}))
    if (response.ok && payload?.preflight) {
      return {
        ok: true,
        preflight: payload.preflight as AccountDeletionPreflight,
      }
    }

    const message =
      typeof payload?.error === "string" && payload.error.length > 0
        ? payload.error
        : "Unable to check account deletion status."
    const normalizedMessage = message.toLowerCase()
    const sessionExpired =
      response.status === 401 ||
      SESSION_ERROR_FRAGMENTS.some((fragment) =>
        normalizedMessage.includes(fragment)
      )

    if (sessionExpired) {
      return {
        ok: false,
        sessionExpired: true,
        message: SESSION_EXPIRED_DELETE_ACCOUNT_ERROR,
      }
    }

    return {
      ok: false,
      sessionExpired: false,
      message,
    }
  } catch {
    return {
      ok: false,
      sessionExpired: false,
      message: "Unable to check account deletion status.",
    }
  }
}
