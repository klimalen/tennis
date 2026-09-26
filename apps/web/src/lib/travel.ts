/** How far a player can still be a practical trip for a practice. */
export const TRAVEL_RADIUS_KM = 150

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const earthKm = 6371
  const deltaLat = (radiusKm / earthKm) * (180 / Math.PI)
  const deltaLng = deltaLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return {
    south: lat - deltaLat,
    north: lat + deltaLat,
    west: lng - deltaLng,
    east: lng + deltaLng,
  }
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
