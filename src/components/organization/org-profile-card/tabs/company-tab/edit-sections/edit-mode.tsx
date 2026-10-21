"use client"

import { Separator } from "@/components/ui/separator"

import type { CompanyEditProps } from "../types"
import { PublicPageSettings } from "./public-page-settings"
import { IdentitySection } from "./identity"
import { ContactSection } from "./contact"
import { AddressSection } from "./address"
import { StorySection } from "./story"
import { PresenceSection } from "./presence"
import { SocialSection } from "./social"

export function EditModeSections(props: CompanyEditProps) {
  return (
    <div className="grid gap-6">
      <IdentitySection {...props} />
      <Separator className="bg-border/60 my-2" />
      <ContactSection {...props} />
      <Separator className="bg-border/60 my-2" />
      <AddressSection {...props} />
      <Separator className="bg-border/60 my-2" />
      <PublicPageSettings {...props} />
      <Separator className="bg-border/60 my-2" />
      <StorySection {...props} />
      <Separator className="bg-border/60 my-2" />
      <PresenceSection {...props} />
      <Separator className="bg-border/60 my-2" />
      <SocialSection {...props} />
    </div>
  )
}
