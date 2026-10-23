import { createElement as h } from "react"
import { ImageResponse } from "next/og"

/** One opaque, uncropped brand treatment for website and organization previews. */
export function renderBrandShareImage({ logo, name }: { logo?: string | null; name: string }) {
  const initials = Array.from(name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join("")).join("").toUpperCase() || "CH"
  return new ImageResponse(
    h("div", {
      style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" },
    }, h("div", {
      style: { width: 352, height: 352, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 76, background: "#fff", border: "2px solid #e8e8e8", boxShadow: "0 12px 36px rgba(0,0,0,0.08)" },
    }, logo
      ? h("img", { src: logo, alt: "", width: 256, height: 256, style: { objectFit: "contain" } })
      : h("span", { style: { color: "#171717", fontSize: 104, fontWeight: 600 } }, initials))),
    { width: 1200, height: 630 },
  )
}
