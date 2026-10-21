"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Field as FieldRow,
  FieldDescription as FieldHelperText,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"

import { FormRow } from "@/components/organization/org-profile-card/shared"
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
  const normalizedCountry = normalizeCountryName(company.addressCountry)
  const usesUnitedStatesStateSelector =
    normalizedCountry.length === 0 || isUnitedStatesCountry(normalizedCountry)
  const normalizedStateValue = normalizeRegionName({
    region: company.addressState,
    country: normalizedCountry,
  })

  return (
    <FormRow
      title="Address"
      description="Mailing address for invoices and communications."
      focusKey="address"
    >
      <div className="grid gap-4">
        <FieldSet className="gap-4 rounded-lg border border-dashed p-4">
          <FieldLegend>Organization address</FieldLegend>
          <FieldHelperText>
            Provide the public address you want Coach House to geocode for map
            placement. We save U.S. state abbreviations in a standardized format
            and geocode this address automatically on save.
          </FieldHelperText>
          <FieldGroup className="gap-4">
            <FieldRow>
              <FieldLabel htmlFor="addressStreet">Street address</FieldLabel>
              <Input
                id="addressStreet"
                name="addressStreet"
                value={company.addressStreet ?? ""}
                onChange={onInputChange}
                placeholder="123 Main St"
              />
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow>
                <FieldLabel htmlFor="addressCity">City</FieldLabel>
                <Input
                  id="addressCity"
                  name="addressCity"
                  value={company.addressCity ?? ""}
                  onChange={onInputChange}
                  placeholder="New York"
                />
              </FieldRow>
              <FieldRow>
                <FieldLabel htmlFor="addressState">State / Region</FieldLabel>
                {usesUnitedStatesStateSelector ? (
                  <>
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
                      <SelectTrigger
                        id="addressState"
                        className="bg-background"
                      >
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
                  </>
                ) : (
                  <Input
                    id="addressState"
                    name="addressState"
                    value={company.addressState ?? ""}
                    onChange={onInputChange}
                    placeholder="Ontario"
                  />
                )}
              </FieldRow>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow>
                <FieldLabel htmlFor="addressPostal">Postal code</FieldLabel>
                <Input
                  id="addressPostal"
                  name="addressPostal"
                  value={company.addressPostal ?? ""}
                  onChange={onInputChange}
                  placeholder="10001"
                />
              </FieldRow>
              <FieldRow>
                <FieldLabel htmlFor="addressCountry">Country</FieldLabel>
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
              </FieldRow>
            </div>
          </FieldGroup>
        </FieldSet>
      </div>
    </FormRow>
  )
}
