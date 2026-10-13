import { siFacebook, siInstagram, siX } from "simple-icons"

import { Button } from "@/components/ui/button"

import type { OrganizationDetailSocialLink } from "./organization-detail-helpers"

// LinkedIn lettering from the mark in Simple Icons 13.21.0 (removed from newer releases).
// https://github.com/simple-icons/simple-icons/blob/13.21.0/icons/linkedin.svg
const LINKEDIN_PATH = "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"

const SOCIAL_BRANDS = {
  twitter: { icon: siX, background: "#000000" },
  facebook: { icon: siFacebook, background: "#0866ff" },
  instagram: {
    icon: siInstagram,
    background: "radial-gradient(circle at 30% 110%, #ffdc80 0%, #fcaf45 20%, #f77737 35%, #e1306c 55%, #c13584 70%, #833ab4 90%)",
  },
  linkedin: { icon: { path: LINKEDIN_PATH }, background: "#2867b2" },
} as const

export function OrganizationDetailSocialButton({
  social,
}: {
  social: OrganizationDetailSocialLink
}) {
  const brand = SOCIAL_BRANDS[social.key]

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative size-7 touch-manipulation rounded-md border-0 p-0 text-white shadow-none transition-opacity hover:bg-transparent hover:text-white hover:opacity-80 dark:hover:bg-transparent motion-reduce:transition-none after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2"
      style={{ background: brand.background }}
    >
      <a
        href={social.href}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${social.label}`}
        title={social.label}
      >
        <svg
          viewBox={social.key === "linkedin" ? "3 3 18 18" : "0 0 24 24"}
          fill="currentColor"
          className="size-4"
          aria-hidden
          focusable="false"
        >
          <path d={brand.icon.path} />
        </svg>
      </a>
    </Button>
  )
}
