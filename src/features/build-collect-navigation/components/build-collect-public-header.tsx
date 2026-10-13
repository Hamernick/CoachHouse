"use client"

import { FIND_PATH } from "@/lib/find/routes"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ArrowUpRightIcon from "lucide-react/dist/esm/icons/arrow-up-right"
import SearchIcon from "lucide-react/dist/esm/icons/search"
import { type ReactNode, useState } from "react"

import { PublicThemeToggle } from "@/components/organization/public-theme-toggle"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { cn } from "@/lib/utils"

import { BUILD_NAVIGATION_ITEMS, COLLECT_NAVIGATION_ITEMS } from "../lib"
import { MenuFigure, type MenuFigureName } from "./menu-figure"
import type {
  BuildCollectActiveArea,
  BuildCollectNavigationItem,
} from "../types"

const MENU_FIGURES: Partial<Record<BuildCollectNavigationItem["id"], MenuFigureName>> = {
  collections: "drawer",
  workspace: "exploded",
  accelerator: "terrain",
  documentation: "slow",
  pricing: "basket",
}

function BuildCollectBrand({
  hideOnDesktop = false,
}: {
  hideOnDesktop?: boolean
}) {
  return (
    <Link
      href="/"
      aria-label="Coach House home"
      className={cn(
        "hover:bg-accent flex w-fit min-w-0 max-w-full items-center gap-2 rounded-lg px-0 py-1.5 transition-colors sm:px-2",
        hideOnDesktop && "md:hidden"
      )}
    >
      <span className="relative flex size-8 shrink-0 items-center justify-center">
        <Image
          src="/coach-house-logo-light.png"
          alt=""
          width={32}
          height={32}
          className="block size-full rounded-[6px] object-contain dark:hidden"
          unoptimized
          priority
        />
        <Image
          src="/coach-house-logo-dark.png"
          alt=""
          width={32}
          height={32}
          className="hidden size-full object-contain dark:block"
          unoptimized
          priority
        />
      </span>
      <span className="hidden min-w-0 flex-col leading-none sm:flex">
        <span className="truncate text-sm font-bold tracking-tight">
          Coach House
        </span>
        <span className="text-muted-foreground pt-0.5 text-[9px] font-semibold tracking-[0.18em]">
          ALPHA
        </span>
      </span>
    </Link>
  )
}

function NavigationCards({ items, onNavigate }: { items: BuildCollectNavigationItem[]; onNavigate: () => void }) {
  return (
    <ul className="grid w-max max-w-[calc(100vw-3.5rem)] gap-1 p-1 md:grid-cols-[auto_auto]">
      {items.map((item) => {
        const figure = MENU_FIGURES[item.id]
        return (
          <li key={item.id}>
            <NavigationMenuLink asChild className="h-full flex-row items-center gap-3 rounded-2xl p-3 [--hairline-plate:var(--popover)] hover:[--hairline-plate:var(--accent)] focus:[--hairline-plate:var(--accent)]">
              <Link href={item.href} onClick={onNavigate} prefetch={item.href.startsWith("/build#") ? true : undefined}>
                {figure ? <MenuFigure name={figure} /> : null}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground text-xs leading-5">
                    {item.description}
                  </span>
                </span>
              </Link>
            </NavigationMenuLink>
          </li>
        )
      })}
    </ul>
  )
}

function BuildCollectNavigation({
  activeArea,
}: {
  activeArea: BuildCollectActiveArea
}) {
  const [openMenu, setOpenMenu] = useState("")
  const router = useRouter()

  function handleMenuChange(value: string) {
    setOpenMenu(value)
    if (value === "build") {
      router.prefetch("/build")
    }
  }

  return (
    <NavigationMenu
      className="relative z-50 flex"
      aria-label="Public navigation"
      delayDuration={100}
      onValueChange={handleMenuChange}
      skipDelayDuration={100}
      value={openMenu}
      viewport={false}
    >
      <NavigationMenuList className="rounded-full border bg-background p-1 shadow-none dark:border-input dark:bg-input/30">
        <NavigationMenuItem value="collect" className="static">
          <NavigationMenuTrigger
            className="data-[active=true]:bg-accent relative h-8 touch-manipulation rounded-full after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 bg-transparent px-3 dark:hover:bg-input/50 dark:focus:bg-input/50 dark:data-[active=true]:bg-input/50 dark:data-[state=open]:bg-input/50"
            data-active={activeArea === "collect"}
          >
            Collect
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute left-1/2 w-max -translate-x-1/2 group-data-[viewport=false]/navigation-menu:rounded-2xl">
            <NavigationCards items={COLLECT_NAVIGATION_ITEMS} onNavigate={() => setOpenMenu("")} />
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem value="build" className="static">
          <NavigationMenuTrigger
            className="data-[active=true]:bg-accent relative h-8 touch-manipulation rounded-full after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 bg-transparent px-3 dark:hover:bg-input/50 dark:focus:bg-input/50 dark:data-[active=true]:bg-input/50 dark:data-[state=open]:bg-input/50"
            data-active={activeArea === "build"}
          >
            Build
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute left-1/2 w-max -translate-x-1/2 group-data-[viewport=false]/navigation-menu:rounded-2xl">
            <NavigationCards items={BUILD_NAVIGATION_ITEMS} onNavigate={() => setOpenMenu("")} />
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export function BuildCollectPublicHeader({
  activeArea,
  authAction,
  hideBrandOnDesktop = false,
  shellActions,
  showPublicSearch = true,
  showPublicNavigation = true,
  themeAction,
}: {
  activeArea: BuildCollectActiveArea
  authAction?: ReactNode
  hideBrandOnDesktop?: boolean
  shellActions?: ReactNode
  showPublicSearch?: boolean
  showPublicNavigation?: boolean
  themeAction?: ReactNode
}) {
  const router = useRouter()
  const builderCta =
    activeArea === "build"
      ? { href: "/sign-up?intent=build", label: "Start free" }
      : { href: "/sign-up?intent=build", label: "Sign up" }

  return (
    <header
      data-build-collect-public-header=""
      className="grid min-h-15 shrink-0 grid-cols-[auto_1fr] items-center gap-2 px-[var(--shell-content-pad,1rem)] py-1.5 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
    >
      <BuildCollectBrand hideOnDesktop={hideBrandOnDesktop} />

      {showPublicNavigation ? <div className="col-span-2 row-start-2 flex min-w-0 items-center justify-center min-[480px]:col-span-1 min-[480px]:col-start-2 min-[480px]:row-start-1">
        <BuildCollectNavigation activeArea={activeArea} />
      </div> : null}

      <div className="col-start-2 row-start-1 flex min-w-0 shrink-0 items-center justify-end gap-3 min-[480px]:col-start-3">
        {showPublicSearch && activeArea === "collect" ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="relative size-8 touch-manipulation rounded-full shadow-none after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-1/2"
            aria-label="Search"
            onClick={() => {
              const searchInput = document.querySelector<HTMLInputElement>(
                "[data-public-map-search-input]"
              )
              if (searchInput) searchInput.focus()
              else router.push(FIND_PATH)
            }}
          >
            <SearchIcon aria-hidden />
          </Button>
        ) : showPublicSearch ? (
          <form action={FIND_PATH} method="get" className="hidden w-52 xl:block">
            <label
              htmlFor={`public-header-search-${activeArea}`}
              className="sr-only"
            >
              Search organizations and resources
            </label>
            <InputGroup className="gap-1">
              <InputGroupInput
                id={`public-header-search-${activeArea}`}
                name="q"
                type="search"
                autoComplete="off"
                placeholder="Start searching"
                className="h-10 rounded-full pl-4"
              />
              <InputGroupAddon>
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  className="size-10 rounded-full"
                  aria-label="Search"
                >
                  <SearchIcon data-icon="inline-start" aria-hidden />
                </Button>
              </InputGroupAddon>
            </InputGroup>
          </form>
        ) : null}

        {authAction}
        <Button asChild size="sm" className={cn("rounded-full shadow-none", activeArea === "collect" && "hidden md:inline-flex")}>
          <Link href={builderCta.href}>
            {builderCta.label}
            <ArrowUpRightIcon data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
        {themeAction ?? (
          <PublicThemeToggle
            variant="ghost"
            size="icon"
            className="hidden size-8 shrink-0 shadow-none sm:inline-flex"
          />
        )}
        {shellActions}
      </div>
    </header>
  )
}
