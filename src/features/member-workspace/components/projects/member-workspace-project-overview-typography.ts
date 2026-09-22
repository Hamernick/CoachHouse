import { cn } from "@/lib/utils"

export const MEMBER_WORKSPACE_PROJECT_OVERVIEW_SPACING_CLASS_NAME =
  "[&_li]:!pl-0 [&_ol]:!pl-4 [&_ul]:!pl-4 [&_p]:whitespace-pre-wrap [&_li]:whitespace-pre-wrap"

export const MEMBER_WORKSPACE_PROJECT_OVERVIEW_EDITOR_CLASS_NAME = cn(
  "min-h-[32rem]",
  MEMBER_WORKSPACE_PROJECT_OVERVIEW_SPACING_CLASS_NAME
)

export const MEMBER_WORKSPACE_PROJECT_OVERVIEW_DOCUMENT_CLASS_NAME = cn(
  "tiptap ProseMirror block w-full min-w-0 break-words",
  "prose prose-sm dark:prose-invert max-w-none",
  "max-h-[32rem] overflow-y-auto bg-transparent px-4 py-3 lg:pt-0 lg:[&>:first-child]:mt-0",
  "prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight",
  "prose-h2:text-2xl prose-h2:font-semibold prose-h3:text-xl prose-h3:font-semibold",
  "prose-p:my-3 prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-5 prose-ol:pl-6 prose-ol:list-inside",
  "prose-blockquote:border-l-2 prose-blockquote:border-primary/50 prose-blockquote:pl-4 prose-blockquote:text-muted-foreground",
  "prose-code:bg-muted prose-code:px-1.5 prose-code:py-1 prose-code:rounded-md prose-code:text-sm",
  "prose-hr:border-border prose-hr:my-6 prose-img:my-4 prose-img:rounded-lg prose-img:border prose-img:border-border/60",
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg",
  "[&_td]:border [&_td]:border-border/70 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_th]:border [&_th]:border-border/70 [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
  MEMBER_WORKSPACE_PROJECT_OVERVIEW_SPACING_CLASS_NAME
)
