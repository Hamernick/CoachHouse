export type BuildCollectActiveArea = "collect" | "build"

export type BuildCollectNavigationItem = {
  id: "explore" | "collections" | "workspace" | "accelerator" | "documentation" | "pricing"
  description: string
  href: string
  label: string
}
