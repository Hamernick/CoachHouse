"use client"

import { updateOrganizationProfileAction } from "@/actions/organization"
import type { OrganizationLaunchInput } from "../types"
import { LaunchInlineForm, type LaunchField } from "./launch-inline-form"

const LOCATION_FIELDS: LaunchField[] = [
  { name: "locationType", label: "Where you work", options: [{ value: "in_person", label: "In person" }, { value: "online", label: "Online" }] },
  { name: "locationUrl", label: "Online destination", type: "url", required: true, when: { name: "locationType", value: "online" } },
  ...[
    { name: "addressStreet", label: "Street address", autoComplete: "street-address" },
    { name: "addressCity", label: "City", autoComplete: "address-level2" },
    { name: "addressState", label: "State / region", autoComplete: "address-level1" },
    { name: "addressPostal", label: "Postal code", autoComplete: "postal-code" },
    { name: "addressCountry", label: "Country", autoComplete: "country-name" },
  ].map((field) => ({ ...field, when: { name: "locationType", value: "in_person" } })),
]

export function LaunchProfileFields({ step, input }: { step: "identity" | "story" | "location"; input: OrganizationLaunchInput }) {
  if (step === "identity") return <LaunchInlineForm
    fields={[{ name: "name", label: "Organization name", required: true, autoComplete: "organization" }, { name: "publicSlug", label: "Profile URL name", required: true, maxLength: 60 }]}
    initialValues={{ name: input.name ?? "", publicSlug: input.publicSlug ?? "" }}
    hint="Your profile URL uses this name. Saving keeps your current visibility."
    onSave={async ({ name, publicSlug }) => {
      if (!name.trim()) return { error: "Enter your organization’s name." }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicSlug.trim())) return { error: "Use lowercase letters, numbers and hyphens for the profile URL name." }
      const result = await updateOrganizationProfileAction({ name: name.trim(), publicSlug: publicSlug.trim() })
      return "error" in result ? { error: result.error } : { message: "Name and profile URL saved." }
    }}
  />
  if (step === "story") return <LaunchInlineForm
    fields={[{ name: "description", label: "What does your organization do?", multiline: true, required: true }]}
    initialValues={{ description: input.description ?? "" }}
    hint="A short description helps people understand who you serve and how."
    onSave={async ({ description }) => {
      if (!description.trim()) return { error: "Add a short description of your work." }
      const result = await updateOrganizationProfileAction({ description: description.trim() })
      return "error" in result ? { error: result.error } : { message: "Description saved to your organization profile." }
    }}
  />
  return <LaunchInlineForm
    fields={LOCATION_FIELDS}
    initialValues={{ locationType: input.locationType ?? "in_person", locationUrl: input.locationUrl ?? "", addressStreet: input.addressStreet ?? input.address ?? "", addressCity: input.addressCity ?? "", addressState: input.addressState ?? "", addressPostal: input.addressPostal ?? "", addressCountry: input.addressCountry ?? "" }}
    hint="Use your organization’s location. This also updates the address on its profile."
    saveLabel="Save location"
    onSave={async (values) => {
      const online = values.locationType === "online"
      const patch = online ? { locationType: "online" as const, locationUrl: values.locationUrl.trim() } : {
        locationType: "in_person" as const,
        address: "",
        ...Object.fromEntries(["addressStreet", "addressCity", "addressState", "addressPostal", "addressCountry"].map((key) => [key, values[key].trim()])),
      }
      if (!online && !values.addressCity.trim() && !values.addressStreet.trim()) return { error: "Add a street address or city to locate your organization." }
      const result = await updateOrganizationProfileAction(patch)
      if ("error" in result) return { error: result.error }
      return { message: online ? "Online destination saved." : result.location.latitude === null || result.location.longitude === null ? "Address saved. We couldn’t place it on the globe; check the city, region and country." : "Location saved. Your green dot is ready on the globe." }
    }}
  />
}
