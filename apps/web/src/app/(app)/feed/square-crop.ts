export const MAX_ZOOM = 4
export const OUTPUT_SIZE = 1080

export function coverScale(frame: number, width: number, height: number) {
  return Math.max(frame / width, frame / height)
}

export function clampFocus(
  focus: { x: number; y: number },
  zoom: number,
  frame: number,
  width: number,
  height: number,
) {
  const scale = coverScale(frame, width, height) * zoom
  const halfW = Math.min(width / 2, frame / scale / 2)
  const halfH = Math.min(height / 2, frame / scale / 2)
  return {
    x: Math.min(width - halfW, Math.max(halfW, focus.x)),
    y: Math.min(height - halfH, Math.max(halfH, focus.y)),
  }
}

export function cropRect(
  focus: { x: number; y: number },
  zoom: number,
  frame: number,
  width: number,
  height: number,
) {
  const scale = coverScale(frame, width, height) * zoom
  const view = frame / scale
  const clamped = clampFocus(focus, zoom, frame, width, height)
  return {
    x: clamped.x - view / 2,
    y: clamped.y - view / 2,
    size: view,
  }
}
