/** Shared spacing for Particle frames and compact legacy workspace tools. */
export const WORKSPACE_PARTICLE_CHROME = {
  root: "flex flex-col gap-0 rounded-[28px] px-0.5 pt-0 pb-0.5 shadow-none",
  header:
    "h-8 shrink-0 items-center gap-2 px-2.5 [@media(pointer:coarse)]:h-auto [@media(pointer:coarse)]:min-h-11",
  title: "truncate text-sm leading-5 font-semibold",
  body: "border-border/60 bg-background rounded-[25px] border p-3",
  footer: "justify-between gap-2 px-3 py-2 text-xs",
  headerControls:
    "[&_[data-slot=button]]:size-7 [@media(pointer:coarse)]:[&_[data-slot=button]]:size-11",
  action: "h-7 [@media(pointer:coarse)]:min-h-11",
} as const
