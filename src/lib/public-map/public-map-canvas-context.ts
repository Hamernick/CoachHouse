export function getPublicMapCanvasContext2D(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: CanvasRenderingContext2DSettings
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  // Narrow the receiver before resolving the two canvases' getContext overloads.
  if ("convertToBlob" in canvas) {
    return canvas.getContext("2d", options)
  }
  return canvas.getContext("2d", options)
}
