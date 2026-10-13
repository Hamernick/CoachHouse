"use client"

import * as React from "react"

import { PersonSocialBrandIcon } from "@/components/people/person-social-brand-icon"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Field,
  FieldControl,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { PersonRolePicker } from "@/features/people-roles/client"
import { type OrgPerson } from "@/actions/people"
import { ManagerSelect } from "@/components/people/manager-select"
import {
  PERSON_CATEGORY_META,
} from "@/lib/people/categories"
import {
  getPersonSocialLinkError,
  PERSON_SOCIAL_PLATFORMS,
  resolvePersonSocialHref,
  type PersonSocialLinks,
  type PersonSocialPlatform,
} from "@/lib/people/social-links"

type PersonProfileFormFieldsProps = {
  formId: string
  initialPersonId?: string | null
  people: OrgPerson[]
  name: string
  title: string
  email: string
  socialLinks: PersonSocialLinks
  extendedSocialLinksEnabled?: boolean
  customRole: string | null
  onCustomRoleChange: (value: string | null) => void
  category: OrgPerson["category"]
  image: string | null
  reportsToId: string | null
  onNameChange: (value: string) => void
  onTitleChange: (value: string) => void
  onEmailChange: (value: string) => void
  onSocialLinkChange: (platform: PersonSocialPlatform, value: string) => void
  onCategoryChange: (value: OrgPerson["category"]) => void
  onImageChange: (value: string | null) => void
  onReportsToChange: (value: string | null) => void
  readOnly?: boolean
}

function canAssignManager(_category: OrgPerson["category"]) {
  return true
}

function resolveInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "?"
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
}

export function PersonProfileFormFields({
  formId,
  initialPersonId,
  people,
  name,
  title,
  email,
  socialLinks,
  extendedSocialLinksEnabled = false,
  category,
  customRole,
  onCustomRoleChange,
  image,
  reportsToId,
  onNameChange,
  onTitleChange,
  onEmailChange,
  onSocialLinkChange,
  onCategoryChange,
  onImageChange,
  onReportsToChange,
  readOnly = false,
}: PersonProfileFormFieldsProps) {
  const categoryMeta = PERSON_CATEGORY_META[category]
  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImageChange(String(reader.result))
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      <section
        className="border-border/60 bg-muted/30 rounded-2xl border p-4"
        aria-labelledby={`${formId}-photo-heading`}
      >
        <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-center">
          <Avatar className="size-20 sm:size-24">
            <AvatarImage src={image ?? undefined} alt={name} />
            <AvatarFallback>{resolveInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-2">
            <Label
              id={`${formId}-photo-heading`}
              htmlFor={`${formId}-image`}
              className="text-sm font-medium"
            >
              Profile photo
            </Label>
            {readOnly ? null : (
              <>
                <Input
                  id={`${formId}-image`}
                  name="image"
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                />
                <p className="text-muted-foreground text-xs">
                  Square images work best.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section
        className="space-y-4"
        aria-labelledby={`${formId}-identity-heading`}
      >
        <div>
          <h3
            id={`${formId}-identity-heading`}
            className="text-sm font-semibold"
          >
            Profile
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Core details used across the platform.
          </p>
        </div>
        <FieldGroup className="gap-4">
          <Field orientation="responsive">
            <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
            <FieldControl>
              <Input
                id={`${formId}-name`}
                name="name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Full name"
                autoComplete="name"
                required
                readOnly={readOnly}
              />
            </FieldControl>
          </Field>
          <Field orientation="responsive">
            <FieldLabel htmlFor={`${formId}-title`}>Title</FieldLabel>
            <FieldControl>
              <Input
                id={`${formId}-title`}
                name="organization-title"
                value={title ?? ""}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder="Role or title"
                autoComplete="organization-title"
                readOnly={readOnly}
              />
            </FieldControl>
          </Field>
          <Field orientation="responsive">
            <FieldLabel>Relationship</FieldLabel>
            <FieldControl>
              <PersonRolePicker value={{ category, customRole }} disabled={readOnly} className="w-full"
                onChange={(role) => { onCategoryChange(role.category); onCustomRoleChange(role.customRole ?? null) }} />
              <FieldDescription className="mt-2">
                This controls where they appear across People and lists.
              </FieldDescription>
              <div className="mt-2 text-xs">
                <span
                  className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 ${categoryMeta.badgeClass}`}
                >
                  <span
                    className={`inline-block size-2 rounded-full ${categoryMeta.dotClass}`}
                    aria-hidden
                  />
                  {customRole || categoryMeta.label}
                </span>
              </div>
            </FieldControl>
          </Field>
          {canAssignManager(category) ? (
            <Field orientation="responsive">
              <FieldLabel>Reports to</FieldLabel>
              <FieldControl>
                <ManagerSelect
                  value={reportsToId}
                  options={people.filter(
                    (person) =>
                      !initialPersonId || person.id !== initialPersonId
                  )}
                  onChange={(value) => onReportsToChange(value)}
                  className="w-full"
                  disabled={readOnly}
                />
                <FieldDescription className="mt-2">
                  Optional: set their reporting line.
                </FieldDescription>
              </FieldControl>
            </Field>
          ) : null}
        </FieldGroup>
      </section>

      <section
        className="space-y-4"
        aria-labelledby={`${formId}-contact-heading`}
      >
        <div>
          <h3
            id={`${formId}-contact-heading`}
            className="text-sm font-semibold"
          >
            Contact
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Optional contact and profile links.
          </p>
        </div>
        <FieldGroup className="gap-4">
          <Field orientation="responsive">
            <FieldLabel htmlFor={`${formId}-email`}>Email</FieldLabel>
            <FieldControl>
              <Input
                id={`${formId}-email`}
                name="email"
                type="email"
                value={email ?? ""}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="name@org.org"
                autoComplete="email"
                readOnly={readOnly}
              />
              <FieldDescription className="mt-2">
                Used for contact cards.
              </FieldDescription>
            </FieldControl>
          </Field>
        </FieldGroup>
      </section>

      <section
        className="space-y-4"
        aria-labelledby={`${formId}-social-media-heading`}
      >
        <div>
          <h3
            id={`${formId}-social-media-heading`}
            className="text-sm font-semibold text-balance"
          >
            Social media
          </h3>
          <p className="text-muted-foreground mt-1 text-xs text-pretty">
            Add the profiles that should appear in People.
          </p>
        </div>
        <FieldGroup className="gap-4">
          {PERSON_SOCIAL_PLATFORMS.filter(
            (platform) =>
              extendedSocialLinksEnabled || platform.key === "linkedin"
          ).map((platform) => {
            const href = resolvePersonSocialHref(
              platform.key,
              socialLinks[platform.key]
            )
            const linkError = getPersonSocialLinkError(
              platform.key,
              socialLinks[platform.key]
            )
            return (
              <Field key={platform.key} className="gap-2">
                <FieldLabel
                  htmlFor={`${formId}-${platform.key}`}
                  className="flex items-center gap-2"
                >
                  <PersonSocialBrandIcon
                    platform={platform.key}
                    className="shrink-0"
                    aria-hidden
                  />
                  {platform.label}
                </FieldLabel>
                <FieldControl className="min-w-0">
                  <InputGroup className="min-w-0">
                    <InputGroupInput
                      id={`${formId}-${platform.key}`}
                      name={platform.key}
                      value={socialLinks[platform.key]}
                      onChange={(event) =>
                        onSocialLinkChange(platform.key, event.target.value)
                      }
                      placeholder={platform.placeholder}
                      autoComplete="url"
                      aria-invalid={Boolean(linkError)}
                      readOnly={readOnly}
                    />
                    <InputGroupAddon className="shrink-0">
                      <InputGroupButton
                        type="button"
                        disabled={!href}
                        onClick={() => window.open(href, "_blank", "noopener")}
                      >
                        Open
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {linkError ? (
                    <FieldDescription className="text-destructive mt-2">
                      {linkError}
                    </FieldDescription>
                  ) : null}
                </FieldControl>
              </Field>
            )
          })}
        </FieldGroup>
      </section>
    </div>
  )
}
