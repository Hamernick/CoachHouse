import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import density from "../documentation-density.module.css"
import { brandIdentityOwner } from "./brand-identity-owner"

export function BrandIdentitySection({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  id: string
  eyebrow?: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 pb-14 font-sans sm:pb-20", className)}
      {...brandIdentityOwner(
        "brand-identity-section",
        "BrandIdentitySection",
        id,
        "section"
      )}
      aria-labelledby={`${id}-title`}
    >
      <div className={density.heading}>
        {eyebrow ? (
          <p className="text-muted-foreground text-[0.68rem] font-semibold tracking-normal">
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={`${id}-title`}
          className="text-lg font-semibold tracking-[-0.025em]"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function BrandIdentitySubsection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("mt-10 first:mt-0 sm:mt-14", className)}>
      <div className={density.heading}>
        <h3 className="text-base font-semibold tracking-[-0.015em]">{title}</h3>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}
