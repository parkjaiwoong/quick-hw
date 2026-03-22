/**
 * Parse POINT/location from DB (coordinates array or string)
 */
export function parsePoint(value: unknown): { lat: number; lng: number } | null {
  if (!value) return null
  if (typeof value === "object" && value !== null && Array.isArray((value as { coordinates?: number[] }).coordinates)) {
    const [lng, lat] = (value as { coordinates: number[] }).coordinates
    return { lat, lng }
  }
  if (typeof value === "object" && value !== null && typeof (value as { x?: number }).x === "number") {
    const v = value as { x: number; y: number }
    return { lng: v.x, lat: v.y }
  }
  if (typeof value === "string") {
    const matches = value.match(/-?\d+(?:\.\d+)?/g)
    if (matches && matches.length >= 2) {
      const lng = Number(matches[0])
      const lat = Number(matches[1])
      return { lat, lng }
    }
  }
  return null
}

/**
 * Haversine distance in km
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)) * 10) / 10
}

/** 1km 미만이면 m, 이상이면 km 표시 */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null) return ""
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}
