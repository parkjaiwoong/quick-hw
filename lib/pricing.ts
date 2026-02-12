/**
 * 배송 요금 계산 (카카오/기성 플랫폼 방식)
 * - 기본요금 + 거리요금 + 물품종류 가산 + 무게 가산 + 크기 가산
 */

const DEFAULT_INCLUDED_KM = 2

/** 물품 종류별 가산료 (원) */
const ITEM_TYPE_SURCHARGE: Record<string, number> = {
  document: 0,
  small: 500,   // 소형 30cm 이하
  medium: 1000, // 중형 30-60cm
  large: 2000,  // 대형 60cm 이상
  other: 1000,
}

/** 무게 구간별 가산료 (kg 기준, 원) */
function getWeightSurcharge(weightKg: number | null | undefined): number {
  if (weightKg == null || weightKg <= 0 || !Number.isFinite(weightKg)) return 0
  if (weightKg <= 5) return 0
  if (weightKg <= 10) return 500
  if (weightKg <= 20) return 1000
  return 2000
}

/** 크기 문자열 파싱 (가로x세로x높이 cm, 예: "40x30x20" 또는 "40*30*20") */
function parsePackageSize(sizeStr: string | null | undefined): [number, number, number] | null {
  if (!sizeStr || typeof sizeStr !== "string") return null
  const normalized = sizeStr.trim().replace(/\s/g, "").replace(/[xX×*]/g, "x")
  const parts = normalized.split("x").map((s) => parseFloat(s)).filter(Number.isFinite)
  if (parts.length !== 3) return null
  return [parts[0], parts[1], parts[2]]
}

/** 크기(가로+세로+높이 cm 합) 구간별 가산료 */
function getSizeSurcharge(packageSize: string | null | undefined): number {
  const dims = parsePackageSize(packageSize)
  if (!dims) return 0
  const sum = dims[0] + dims[1] + dims[2]
  if (sum <= 100) return 0
  if (sum <= 150) return 300
  if (sum <= 200) return 500
  return 1000
}

export function getItemTypeSurcharge(itemType: string | null | undefined): number {
  if (!itemType) return 0
  return ITEM_TYPE_SURCHARGE[itemType] ?? 0
}

export function getWeightSurchargeExport(weightKg: number | null | undefined): number {
  return getWeightSurcharge(weightKg)
}

export function getSizeSurchargeExport(packageSize: string | null | undefined): number {
  return getSizeSurcharge(packageSize)
}

export interface DeliveryFeeParams {
  baseFee: number
  perKmFee: number
  includedDistanceKm?: number
  distanceKm: number
  itemType?: string | null
  itemWeightKg?: number | null
  packageSize?: string | null
}

/**
 * 배송 총 요금 계산 (거리 + 물품종류 + 무게 + 크기)
 */
export function calculateDeliveryFee(params: DeliveryFeeParams): number {
  const {
    baseFee,
    perKmFee,
    includedDistanceKm = DEFAULT_INCLUDED_KM,
    distanceKm,
    itemType,
    itemWeightKg,
    packageSize,
  } = params

  const distanceFee = Math.max(0, distanceKm - includedDistanceKm) * perKmFee
  const baseAndDistance = baseFee + distanceFee
  const itemSurcharge = getItemTypeSurcharge(itemType ?? null)
  const weightSurcharge = getWeightSurcharge(itemWeightKg ?? null)
  const sizeSurcharge = getSizeSurcharge(packageSize ?? null)

  const total = baseAndDistance + itemSurcharge + weightSurcharge + sizeSurcharge
  return Math.round(total)
}
