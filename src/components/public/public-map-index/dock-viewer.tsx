"use client"

import { createContext, useContext, useRef, useState, useTransition } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import UserRoundIcon from "lucide-react/dist/esm/icons/user-round"
import LayoutDashboardIcon from "lucide-react/dist/esm/icons/layout-dashboard"
import SettingsIcon from "lucide-react/dist/esm/icons/settings"
import LogOutIcon from "lucide-react/dist/esm/icons/log-out"
import LogInIcon from "lucide-react/dist/esm/icons/log-in"
import InfoIcon from "lucide-react/dist/esm/icons/info"
import FileTextIcon from "lucide-react/dist/esm/icons/file-text"
import ShieldIcon from "lucide-react/dist/esm/icons/shield"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/lib/toast"
import { PublicMapAboutContent } from "./footer"
import type { PublicMapIndexProps } from "./public-map-index-types"

const AccountSettingsDialog = dynamic(() => import("@/components/account-settings/account-settings-dialog").then((module) => module.AccountSettingsDialog), { ssr: false })
const MENU_ITEM_CLASS = "min-h-11 gap-3 rounded-xl px-3 text-sm"

export const PublicMapDockViewerContext = createContext<PublicMapIndexProps["viewer"]>(null)

export function PublicMapDockAvatar() {
  const viewer = useContext(PublicMapDockViewerContext)
  const router = useRouter()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"profile" | "public-profile" | null>(null)
  const [signOutPending, startSignOut] = useTransition()
  const name = viewer?.displayName || viewer?.email || "Your account"
  const avatar = <Avatar className="size-8 shrink-0 border">
    <AvatarImage src={viewer?.avatarUrl ?? undefined} alt="" />
    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
      {viewer ? name.slice(0, 2).toUpperCase() : <UserRoundIcon aria-hidden />}
    </AvatarFallback>
  </Avatar>

  function signOut() {
    startSignOut(async () => {
      try {
        const response = await fetch("/api/auth/signout", { method: "POST" })
        if (!response.ok) throw new Error("Sign out failed")
        setMenuOpen(false)
        router.replace("/")
        router.refresh()
      } catch {
        toast.error("Unable to sign out. Please try again.")
      }
    })
  }

  return <>
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="ghost" size="icon" className="size-11 shrink-0 rounded-full" aria-label="Open your account">
          {avatar}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} collisionPadding={12} aria-label="Account menu"
        className="w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl p-1.5 shadow-none motion-reduce:animate-none"
        onCloseAutoFocus={(event) => { if (aboutOpen || settingsTab) event.preventDefault() }}>
        <DropdownMenuLabel className="flex min-w-0 items-center gap-3 px-3 py-2.5">
          {avatar}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{viewer ? name : "Coach House"}</span>
            <span className="text-muted-foreground block truncate text-xs font-normal">{viewer?.email || "Find, collect, and build"}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {viewer ? <>
          <DropdownMenuItem asChild className={MENU_ITEM_CLASS}><Link href="/workspace"><LayoutDashboardIcon aria-hidden />Workspace</Link></DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setSettingsTab("public-profile")}><UserRoundIcon aria-hidden />Public profile</DropdownMenuItem>
          <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setSettingsTab("profile")}><SettingsIcon aria-hidden />Settings</DropdownMenuItem>
        </> : <DropdownMenuItem asChild className={MENU_ITEM_CLASS}><Link href="/home-canvas?section=login"><LogInIcon aria-hidden />Sign in</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_ITEM_CLASS} onSelect={() => setAboutOpen(true)}><InfoIcon aria-hidden />About Coach House</DropdownMenuItem>
        <DropdownMenuItem asChild className={MENU_ITEM_CLASS}><Link href="/terms"><FileTextIcon aria-hidden />Terms of Service</Link></DropdownMenuItem>
        <DropdownMenuItem asChild className={MENU_ITEM_CLASS}><Link href="/privacy"><ShieldIcon aria-hidden />Privacy Policy</Link></DropdownMenuItem>
        {viewer ? <>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={MENU_ITEM_CLASS} disabled={signOutPending} onSelect={(event) => { event.preventDefault(); signOut() }}><LogOutIcon aria-hidden />{signOutPending ? "Signing out…" : "Log out"}</DropdownMenuItem>
        </> : null}
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
      <DialogContent className="rounded-2xl shadow-none" onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus() }}>
        <DialogHeader><DialogTitle>About Coach House</DialogTitle><DialogDescription>Find resources. Build your nonprofit.</DialogDescription></DialogHeader>
        <PublicMapAboutContent />
      </DialogContent>
    </Dialog>
    {viewer && settingsTab ? <AccountSettingsDialog open initialTab={settingsTab} defaultName={viewer.displayName} defaultEmail={viewer.email}
      onOpenChange={(open) => { if (!open) { setSettingsTab(null); requestAnimationFrame(() => triggerRef.current?.focus()) } }} /> : null}
  </>
}
