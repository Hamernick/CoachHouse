"use client"

import { useEffect, useState } from "react"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function OrganizationSearchField({
  entity = "organizations",
  value,
  onSearch,
}: {
  entity?: "organizations" | "projects"
  value: string
  onSearch: (value: string) => void
}) {
  const [query, setQuery] = useState(value)
  useEffect(() => setQuery(value), [value])
  return (
    <form
      role="search"
      className="relative w-full min-w-0 sm:w-60 sm:shrink-0"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch(query)
      }}
    >
      <Input
        type="search"
        name={`${entity}-search`}
        aria-label={`Search ${entity}`}
        placeholder={`Search ${entity}…`}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          if (!event.target.value) onSearch("")
        }}
        className="h-11 rounded-lg pr-12 sm:h-8 sm:pr-9"
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`Find ${entity}`}
        className="absolute top-0 right-0 size-11 rounded-lg sm:size-8"
      >
        <SearchIcon className="size-4" aria-hidden />
      </Button>
    </form>
  )
}
