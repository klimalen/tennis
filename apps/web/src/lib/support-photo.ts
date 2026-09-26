const MAX_EDGE = 1600
const MAX_BYTES = 4_000_000

/** Shrink a support photo to a JPEG the upload limit will accept. */
export async function prepareSupportPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a photo.')
  }

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('Could not prepare the photo. Try again.')

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('Could not prepare the photo. Try again.')
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvasBlob(canvas, 0.85)
  if (blob.size <= MAX_BYTES) return blob

  const smaller = await canvasBlob(canvas, 0.7)
  if (smaller.size <= MAX_BYTES) return smaller
  throw new Error('That photo is too large. Try another one.')
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not prepare the photo. Try again.'))
    }, 'image/jpeg', quality)
  })
}
