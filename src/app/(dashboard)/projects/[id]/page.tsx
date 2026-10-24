import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Project Details",
  description: "Review project tasks, files, and team activity.",
}

// Shared authorized project-detail composition; navigation follows the current directory.
export { default } from "../../organizations/[id]/page"
