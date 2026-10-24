"use client"

import styles from "../../../profile-edit-fields.module.css"

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
    <div className={styles.sections}>
      <IdentitySection {...props} />
      <ContactSection {...props} />
      <AddressSection {...props} />
      <PublicPageSettings {...props} />
      <StorySection {...props} />
      <PresenceSection {...props} />
      <SocialSection {...props} />
    </div>
  )
}
