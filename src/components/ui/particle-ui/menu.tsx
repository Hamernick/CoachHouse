"use client"

import type { ComponentProps } from "react"
import { Menu } from "@openai/apps-sdk-ui/components/Menu"

// The SDK portals its content without a className hook. A layout-free child
// scopes the existing Particle foundation and portal layer to these menus.
export const ParticleMenu = Object.assign(
  (props: ComponentProps<typeof Menu>) => <Menu {...props} />,
  {
    ...Menu,
    Content: ({ children, ...props }: ComponentProps<typeof Menu.Content>) => (
      <Menu.Content align="start" minWidth={208} {...props}><div className="particle-ui-menu contents">{children}</div></Menu.Content>
    ),
    SubContent: ({ children, ...props }: ComponentProps<typeof Menu.SubContent>) => (
      <Menu.SubContent minWidth={208} {...props}><div className="particle-ui-menu contents">{children}</div></Menu.SubContent>
    ),
  },
)
