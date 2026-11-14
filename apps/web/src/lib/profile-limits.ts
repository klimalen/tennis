/** Shared caps for player display name + @username (edit + onboarding). */
export const PROFILE_NAME_MAX = 25
export const PROFILE_USERNAME_MAX = 25

export const PROFILE_LENGTH_ERROR = 'No more than 25 characters'

export function exceedsProfileLimit(value: string, max: number = PROFILE_NAME_MAX): boolean {
  return value.length > max
}
