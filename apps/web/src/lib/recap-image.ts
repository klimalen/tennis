/** Shrink a recap photo for upload, keeping its aspect ratio. */
export function compressRecapPhoto(file: File, maxEdge = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const longest = Math.max(image.width, image.height)
      const scale = longest > maxEdge ? maxEdge / longest : 1
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Could not prepare the photo'))
        return
      }
      context.drawImage(image, 0, 0, width, height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) reject(new Error('Could not prepare the photo'))
        else resolve(blob)
      }, 'image/jpeg', 0.82)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not prepare the photo'))
    }
    image.src = url
  })
}
