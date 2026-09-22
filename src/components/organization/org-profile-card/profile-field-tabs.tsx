"use client"

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { getReactGrabOwnerProps } from "@/components/dev/react-grab-surface"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ProfileField, type ProfileFieldProps } from "./shared"
import { useProfileFieldTabsState } from "./profile-field-tabs-state"

const FIELD_TABS_SOURCE =
  "src/components/organization/org-profile-card/profile-field-tabs.tsx"

export function ProfileFieldTabs({
  group,
  label,
  children,
}: {
  group: string
  label: string
  children: ReactNode
}) {
  const state = useProfileFieldTabsState()
  const [localSelection, setLocalSelection] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const pendingErrorFocus = useRef<string | null>(null)
  const fields = Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<ProfileFieldProps>(child) ||
      child.type !== ProfileField
    )
      return []
    return [
      { id: child.props.focusKey ?? String(child.props.label), element: child },
    ]
  })
  const requested = state?.selections[group] ?? localSelection
  const activeField =
    fields.find((field) => field.id === requested)?.id ?? fields[0]?.id
  const selectField = state?.select
  const select = useCallback(
    (field: string) => {
      if (selectField) selectField(group, field)
      else setLocalSelection(field)
    },
    [group, selectField]
  )
  const errorField = fields.find((field) => field.id === state?.firstError)?.id
  const focusField = fields.find((field) => field.id === state?.focusKey)?.id

  useEffect(() => {
    if (!requested && activeField) select(activeField)
  }, [requested, activeField, select])

  useEffect(() => {
    if (focusField) select(focusField)
  }, [focusField, select])

  const validationAttempt = state?.validationAttempt
  const handledValidation = useRef(validationAttempt)
  useEffect(() => {
    if (handledValidation.current === validationAttempt) return
    handledValidation.current = validationAttempt
    pendingErrorFocus.current = errorField ?? null
    if (errorField) select(errorField)
  }, [errorField, validationAttempt, select])

  useEffect(() => {
    if (!activeField || pendingErrorFocus.current !== activeField) return
    const frame = requestAnimationFrame(() => {
      pendingErrorFocus.current = null
      const panel = Array.from(
        rootRef.current?.querySelectorAll<HTMLElement>(
          "[data-organization-focus-target]"
        ) ?? []
      ).find(
        (element) => element.dataset.organizationFocusTarget === activeField
      )
      const control = panel?.querySelector<HTMLElement>(
        'input, textarea, [contenteditable="true"], [role="combobox"]'
      )
      ;(control ?? panel)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [activeField, errorField, validationAttempt])

  if (!activeField) return null

  return (
    <div
      ref={rootRef}
      className="min-w-0"
      {...getReactGrabOwnerProps({
        ownerId: `organization-profile:field-tabs:${group}`,
        component: "ProfileFieldTabs",
        source: FIELD_TABS_SOURCE,
        slot: "field-tabs",
        tokenSource: "src/components/ui/tabs.tsx",
        primitiveImport: "@/components/ui/tabs",
      })}
    >
      <Tabs
        value={activeField}
        onValueChange={select}
        className="min-w-0 gap-3"
      >
        <TabsList
          aria-label={label}
          className="h-auto max-w-full flex-wrap justify-start gap-1 rounded-2xl bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {fields.map(({ id, element }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="border-border/60 h-11 flex-none rounded-full px-3 transition-[color,background-color,box-shadow] sm:h-8"
            >
              {element.props.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {fields.map(({ id, element }) => (
          <TabsContent
            key={id}
            value={id}
            forceMount
            hidden={id !== activeField}
            inert={id !== activeField}
            className="min-w-0 data-[state=inactive]:hidden"
          >
            {cloneElement(element, { hideLabel: true })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
