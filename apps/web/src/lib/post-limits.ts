/** Shared cap for photos on a recap or a regular post. */
export const POST_PHOTO_MAX = 5

/** Shared cap for manual feed post body (new + edit + API). */
export const POST_BODY_MAX = 1000

export const POST_BODY_LENGTH_ERROR = 'No more than 1000 characters'

export function clampPostBody(value: string): string {
  return value.slice(0, POST_BODY_MAX)
}

export function exceedsPostBodyLimit(value: string): boolean {
  return value.length > POST_BODY_MAX
}
