import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

export const alt = "Coach House — The platform for nonprofits"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/coach-house-logo-dark.png"))

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          padding: "56px 72px",
          background: "#fafafa",
          color: "#171717",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* ImageResponse requires a native image and embeds the local asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${logo.toString("base64")}`}
            alt=""
            width={88}
            height={88}
          />
          <span style={{ fontSize: 36, fontWeight: 700 }}>Coach House</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 48,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -3,
            lineHeight: 1.08,
          }}
        >
          <span>The platform</span>
          <span>for nonprofits.</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#4d4d4d" }}>
          Shared Workspace. Guided training. Executive Coaches.
        </div>
        <div style={{ marginTop: "auto", fontSize: 22, color: "#4d4d4d" }}>
          coachhouse.app
        </div>
      </div>
    ),
    size,
  )
}
