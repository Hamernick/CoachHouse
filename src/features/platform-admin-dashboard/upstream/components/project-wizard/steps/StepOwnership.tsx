import type { ProjectData } from "../types"
import type { StepQuickCreateUserOption } from "./StepQuickCreate"
import { Label } from "../../ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar"
import { Checkbox } from "../../ui/checkbox"

interface StepOwnershipProps {
  data: ProjectData
  updateData: (updates: Partial<ProjectData>) => void
  people?: StepQuickCreateUserOption[]
  organizations?: { id: string; name: string }[]
}

export function StepOwnership({
  data,
  updateData,
  people = [],
  organizations = [],
}: StepOwnershipProps) {
  const owner = people.find((person) => person.id === data.ownerId)

  function togglePerson(
    target: "contributors" | "stakeholders",
    id: string,
    checked: boolean
  ) {
    const current =
      target === "contributors" ? data.contributorIds : data.stakeholderIds
    const valid = current.filter((personId) =>
      people.some((person) => person.id === personId)
    )
    const next = checked
      ? [...new Set([...valid, id])]
      : valid.filter((personId) => personId !== id)
    if (target === "contributors") {
      updateData({
        contributorIds: next,
        contributorOwnerships: next.map((accountId) => ({
          accountId,
          access: "can_edit",
        })),
      })
    } else {
      updateData({
        stakeholderIds: next,
        stakeholderOwnerships: next.map((accountId) => ({
          accountId,
          access: "can_view",
        })),
      })
    }
  }

  return (
    <div className="space-y-4">
      {organizations.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="ownership-organization">Organizations</Label>
          <Select
            value={
              organizations.some((org) => org.id === data.clientId)
                ? data.clientId
                : ""
            }
            onValueChange={(clientId) =>
              updateData({
                clientId,
                ownerId: undefined,
                contributorIds: [],
                stakeholderIds: [],
                contributorOwnerships: [],
                stakeholderOwnerships: [],
              })
            }
          >
            <SelectTrigger id="ownership-organization">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="ownership-owner">Project owner</Label>
        <Select
          value={owner?.id ?? ""}
          disabled={people.length === 0}
          onValueChange={(ownerId) => updateData({ ownerId })}
        >
          <SelectTrigger id="ownership-owner">
            <SelectValue placeholder="Select owner" />
          </SelectTrigger>
          <SelectContent>
            {people.map((person) => (
              <SelectItem key={person.id} value={person.id}>
                {person.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {people.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No assignable people are available.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs">
            Project responsibilities do not change organization access.
          </p>
          {(["contributors"] as const).map((target) => (
            <fieldset key={target} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">
                {"Team members"}
              </legend>
              {people
                .filter((person) => person.id !== owner?.id)
                .map((person) => (
                  <Label
                    key={person.id}
                    className="flex items-center gap-2 font-normal"
                  >
                    <Checkbox
                      checked={(target === "contributors"
                        ? data.contributorIds
                        : data.stakeholderIds
                      ).includes(person.id)}
                      onCheckedChange={(checked) =>
                        togglePerson(target, person.id, checked === true)
                      }
                    />
                    <Avatar className="h-5 w-5">
                      {person.avatar && (
                        <AvatarImage src={person.avatar} alt="" />
                      )}
                      <AvatarFallback className="text-[10px]">
                        {person.name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    {person.name}
                  </Label>
                ))}
            </fieldset>
          ))}
        </>
      )}
    </div>
  )
}
