"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import styles from "../../../profile-edit-fields.module.css"
import {
  FormRow,
  ProfileField,
} from "@/components/organization/org-profile-card/shared"
import {
  isUnitedStatesCountry,
  normalizeCountryName,
  normalizeRegionName,
  US_STATE_OPTIONS,
} from "@/lib/location/organization-location"
import type { CompanyEditProps } from "../types"

export function AddressSection({
  company,
  onInputChange,
  onUpdate,
  onDirty,
}: CompanyEditProps) {
  const isOnlineOnly = company.locationType === "online"
  const normalizedCountry = normalizeCountryName(company.addressCountry)
  const usesUnitedStatesStateSelector =
    normalizedCountry.length === 0 || isUnitedStatesCountry(normalizedCountry)
  const normalizedStateValue = normalizeRegionName({
    region: company.addressState,
    country: normalizedCountry,
  })

  return (
    <FormRow
      layout="stacked"
      inset={false}
      title="Location"
      focusKey="address"
    >
      <div className={styles.group}>
        <ProfileField label="Location type" focusKey="publicLocationType">
          <Select
            value={isOnlineOnly ? "online" : "in_person"}
            onValueChange={(value) => {
              if (value !== "online" && value !== "in_person") return
              const website = company.publicUrl?.trim() || company.locationUrl || ""
              onUpdate(
                value === "online"
                  ? { locationType: value, publicUrl: website, locationUrl: website }
                  : { locationType: value }
              )
              onDirty()
            }}
          >
            <SelectTrigger id="publicLocationType" className="bg-background">
              <SelectValue placeholder="Select location type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_person">Physical location</SelectItem>
              <SelectItem value="online">Web resource</SelectItem>
            </SelectContent>
          </Select>
        </ProfileField>
        {!isOnlineOnly ? (
          <>
            <ProfileField label="Street address" focusKey="addressStreet">
              <Input
                id="addressStreet"
                name="addressStreet"
                value={company.addressStreet ?? ""}
                onChange={onInputChange}
                placeholder="123 Main St"
              />
            </ProfileField>
            <ProfileField label="City" focusKey="addressCity">
              <Input
                id="addressCity"
                name="addressCity"
                value={company.addressCity ?? ""}
                onChange={onInputChange}
                placeholder="New York"
              />
            </ProfileField>
            <ProfileField label="State / Region" focusKey="addressState">
              {usesUnitedStatesStateSelector ? (
                <Select
                  value={normalizedStateValue || undefined}
                  onValueChange={(value) => {
                    onUpdate({
                      addressState: value,
                      addressCountry: normalizedCountry || "United States",
                    })
                    onDirty()
                  }}
                >
                  <SelectTrigger id="addressState" className="bg-background">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({option.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="addressState"
                  name="addressState"
                  value={company.addressState ?? ""}
                  onChange={onInputChange}
                  placeholder="Ontario"
                />
              )}
            </ProfileField>
            <ProfileField label="Postal code" focusKey="addressPostal">
              <Input
                id="addressPostal"
                name="addressPostal"
                value={company.addressPostal ?? ""}
                onChange={onInputChange}
                placeholder="10001"
              />
            </ProfileField>
            <ProfileField label="Country" focusKey="addressCountry">
              <Input
                id="addressCountry"
                name="addressCountry"
                value={company.addressCountry ?? ""}
                onChange={onInputChange}
                placeholder="United States"
                list="organization-country-suggestions"
              />
              <datalist id="organization-country-suggestions">
                <option value="United States" />
                <option value="Canada" />
                <option value="United Kingdom" />
                <option value="Australia" />
              </datalist>
            </ProfileField>
          </>
        ) : null}
      </div>
    </FormRow>
  )
}
