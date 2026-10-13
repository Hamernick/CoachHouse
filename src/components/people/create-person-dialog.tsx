"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import PlusIcon from "lucide-react/dist/esm/icons/plus"

import { upsertPersonAction, type OrgPerson } from "@/actions/people"
import { PersonProfileFormFields } from "@/components/people/person-profile-form-fields"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "@/lib/toast"
import {
  findPersonSocialLinkError,
  readPersonSocialLinks,
  type PersonSocialLinks,
  type PersonSocialPlatform,
} from "@/lib/people/social-links"

type Props = {
  triggerClassName?: string
  initial?: Partial<OrgPerson>
  onSaved?: (id: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  people?: OrgPerson[]
  readOnly?: boolean
  extendedSocialLinksEnabled?: boolean
}

export function CreatePersonDialog({
  triggerClassName,
  initial,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  people = [],
  readOnly = false,
  extendedSocialLinksEnabled = false,
}: Props) {
  const router = useRouter()
  const formId = React.useId()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const open = controlledOpen ?? uncontrolledOpen
  const [name, setName] = React.useState(initial?.name ?? "")
  const [title, setTitle] = React.useState(initial?.title ?? "")
  const [email, setEmail] = React.useState(initial?.email ?? "")
  const [socialLinks, setSocialLinks] = React.useState<PersonSocialLinks>(() =>
    readPersonSocialLinks(initial)
  )
  const [category, setCategory] = React.useState<OrgPerson["category"]>(
    initial?.category ?? "staff"
  )
  const [customRole, setCustomRole] = React.useState<string | null>(initial?.customRole ?? null)
  const [image, setImage] = React.useState<string | null>(
    initial?.image ?? null
  )
  const [reportsToId, setReportsToId] = React.useState<string | null>(
    initial?.reportsToId ?? null
  )
  const isEditing = Boolean(initial?.id)
  const primaryLabel = isEditing ? "Save changes" : "Add person"
  const submittingLabel = isEditing ? "Saving…" : "Adding…"
  const socialLinkError = findPersonSocialLinkError(socialLinks)
  const canSubmit =
    !readOnly &&
    Boolean(name.trim()) &&
    Boolean(category) &&
    !socialLinkError &&
    !pending

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
      onOpenChange?.(nextOpen)
    },
    [controlledOpen, onOpenChange]
  )

  const resetForm = React.useCallback(() => {
    setName(initial?.name ?? "")
    setTitle(initial?.title ?? "")
    setEmail(initial?.email ?? "")
    setSocialLinks(readPersonSocialLinks(initial))
    setCategory(initial?.category ?? "staff")
    setCustomRole(initial?.customRole ?? null)
    setImage(initial?.image ?? null)
    setReportsToId(initial?.reportsToId ?? null)
  }, [initial])

  React.useEffect(() => {
    if (open) resetForm()
  }, [open, resetForm])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  function handleCancel() {
    setOpen(false)
    resetForm()
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (readOnly || !name.trim() || socialLinkError || pending) return

    startTransition(async () => {
      const toastId = toast.loading(
        initial?.id ? "Saving changes…" : "Adding person…"
      )
      const result = await upsertPersonAction({
        id: initial?.id,
        name: name.trim(),
        title: title.trim(),
        email: email.trim(),
        ...(extendedSocialLinksEnabled
          ? socialLinks
          : { linkedin: socialLinks.linkedin }),
        category,
        customRole,
        image,
        reportsToId: reportsToId || null,
      })

      if (!("error" in result)) {
        setOpen(false)
        resetForm()
        onSaved?.(result.id)
        toast.success(initial?.id ? "Person updated" : "Person added", {
          id: toastId,
        })
        router.refresh()
        return
      }

      toast.error(result.error, { id: toastId })
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button data-tour="people-add" className={triggerClassName} size="sm">
          <PlusIcon className="size-4" />
          <span>Add</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col overflow-hidden sm:max-w-xl"
      >
        <SheetHeader className="border-border/60 shrink-0 border-b px-6 pt-6 pb-4 text-left">
          <SheetTitle>
            {readOnly
              ? "Person details"
              : isEditing
                ? "Edit person"
                : "Add person"}
          </SheetTitle>
          <SheetDescription>
            {readOnly
              ? "View the profile data used by People, org charts, and canvas relationship views."
              : "Manage the profile data used by People, org charts, and canvas relationship views."}
          </SheetDescription>
        </SheetHeader>

        <form
          id={formId}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            <PersonProfileFormFields
              formId={formId}
              initialPersonId={initial?.id ?? null}
              people={people}
              name={name}
              title={title}
              email={email}
              socialLinks={socialLinks}
              extendedSocialLinksEnabled={extendedSocialLinksEnabled}
              category={category}
              customRole={customRole}
              onCustomRoleChange={setCustomRole}
              image={image}
              reportsToId={reportsToId}
              onNameChange={setName}
              onTitleChange={setTitle}
              onEmailChange={setEmail}
              onSocialLinkChange={(
                platform: PersonSocialPlatform,
                value: string
              ) =>
                setSocialLinks((current) => ({
                  ...current,
                  [platform]: value,
                }))
              }
              onCategoryChange={setCategory}
              onImageChange={setImage}
              onReportsToChange={setReportsToId}
              readOnly={readOnly}
            />
          </div>

          <SheetFooter className="border-border/60 bg-background/95 shrink-0 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {readOnly ? (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Close
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit} aria-busy={pending}>
                  {pending ? submittingLabel : primaryLabel}
                </Button>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
