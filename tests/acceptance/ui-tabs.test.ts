import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  Tabs,
  TabsList,
  TabsTrigger,
  tabsListVariants,
} from "@/components/ui/tabs"

describe("ui tabs", () => {
  it("supports the shadcn line variant on TabsList", () => {
    expect(tabsListVariants({ variant: "line" })).toContain("bg-transparent")
    expect(tabsListVariants({ variant: "line" })).toContain("gap-1")

    const markup = renderToStaticMarkup(
      React.createElement(
        Tabs,
        { defaultValue: "people" },
        React.createElement(
          TabsList,
          { variant: "line" },
          React.createElement(TabsTrigger, { value: "people" }, "People"),
          React.createElement(TabsTrigger, { value: "documents" }, "Documents")
        )
      )
    )

    expect(markup).toContain('data-variant="line"')
    expect(markup).toContain("group/tabs-list")
    expect(markup).toContain("bg-transparent")
    expect(markup).toContain("group-data-[variant=line]/tabs-list")
    expect(markup).toContain("data-[state=active]:after:opacity-100")
  })
})

// Nested workspace panels must not inherit the rail's vertical presentation.
it("scopes orientation to the nearest Tabs root", () => {
  const markup = renderToStaticMarkup(
    React.createElement(Tabs, { orientation: "vertical", defaultValue: "org" },
      React.createElement(TabsList, null,
        React.createElement(TabsTrigger, { value: "org" }, "Organization")),
      React.createElement(Tabs, { defaultValue: "about" },
        React.createElement(TabsList, null,
          React.createElement(TabsTrigger, { value: "about" }, "About"),
          React.createElement(TabsTrigger, { value: "activity" }, "Activity"))))
  )
  const lists = markup.match(/<div[^>]*data-slot="tabs-list"[^>]*>/g) ?? []
  const triggers = markup.match(/<button[^>]*data-slot="tabs-trigger"[^>]*>/g) ?? []
  expect(lists).toHaveLength(2)
  expect(lists[0]).toContain('data-orientation="vertical"')
  expect(lists[1]).toContain('data-orientation="horizontal"')
  expect(triggers).toHaveLength(3)
  expect(triggers[0]).toContain('data-orientation="vertical"')
  expect(triggers[1]).toContain('data-orientation="horizontal"')
  expect(triggers[2]).toContain('data-orientation="horizontal"')
  expect(markup).not.toContain("group-data-[orientation=")
})
