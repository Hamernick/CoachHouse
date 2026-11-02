"use client"

// Import only used primitives. Coach House owns domain contracts and behavior;
// the pinned library owns these controls and their scoped foundation.
export { ParticleButton, ParticleButtonLink, ParticleInput, ParticleTextarea, ParticleCheckbox, ParticleSwitch, ParticleBadge, ParticleAlert } from "./controls"
export { Menu as ParticleMenu } from "@openai/apps-sdk-ui/components/Menu"
export { ParticleRadioGroup } from "./radio-group"
export { EmptyMessage as ParticleEmptyMessage } from "@openai/apps-sdk-ui/components/EmptyMessage"
export { ParticleSelect, type ParticleSelectProps } from "./select"
export { ParticleAlertDialogAction, ParticleAlertDialogCancel } from "./alert-dialog-actions"
export { ParticlePopover } from "./popover"
export { Avatar as ParticleAvatar } from "@openai/apps-sdk-ui/components/Avatar"
export { SegmentedControl as ParticleSegmentedControl } from "@openai/apps-sdk-ui/components/SegmentedControl"
