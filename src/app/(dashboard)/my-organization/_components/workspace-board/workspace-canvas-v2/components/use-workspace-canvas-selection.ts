// Dragging empty canvas pans on mouse, touch, and hybrid devices. Shift enables
// marquee selection; tutorials keep their existing selection lock.
export function resolveWorkspaceCanvasSelection(tutorial: boolean) {
  return {
    selectionOnDrag: false,
    panOnDrag: true,
    selectionKeyCode: tutorial ? null : "Shift",
  }
}
