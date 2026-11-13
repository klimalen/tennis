/** Group sessions have a cap and no minimum roster. Singles and doubles stay fixed. */
export const GROUP_SEAT_MIN = 1
export const GROUP_SEAT_MAX = 32
export const GROUP_SEAT_DEFAULT = 8

export type GameFormatChoice = 'singles' | 'doubles' | 'group'

export function seatsForFormat(
  format: string,
  requested?: unknown,
): { max_players: number } | { error: string } {
  if (format === 'singles') return { max_players: 2 }
  if (format === 'doubles' || format === 'mixed_doubles') return { max_players: 4 }
  if (format === 'group') {
    const seats = typeof requested === 'number' ? requested : Number(requested)
    if (!Number.isInteger(seats) || seats < GROUP_SEAT_MIN || seats > GROUP_SEAT_MAX) {
      return { error: `Choose ${GROUP_SEAT_MIN} to ${GROUP_SEAT_MAX} players` }
    }
    return { max_players: seats }
  }
  return { error: 'Choose a format' }
}
