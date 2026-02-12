"use server"

const KAKAO_BASE = "https://dapi.kakao.com/v2/local"

const REST_KEY_MESSAGE =
  "주소 검색/현재 위치 변환은 카카오 REST API 키가 필요합니다. " +
  "카카오 개발자 콘솔(developers.kakao.com) → 내 애플리케이션 → 앱 키 → REST API 키를 복사해 " +
  ".env.local에 KAKAO_REST_API_KEY=복사한키 형태로 추가한 뒤 서버를 다시 실행해 주세요. (JavaScript 키가 아닌 REST API 키입니다.)"

function getKakaoRestKey(): string {
  return (process.env.KAKAO_REST_API_KEY ?? "").trim()
}

export interface AddressSearchItem {
  /** 실제 주소 (저장·요금 계산용) */
  address: string
  lat: number
  lng: number
  /** 장소명 (성북구청, 성북구보건소 등, 표시용) */
  placeName?: string
}

function parseKakaoErrorFromBody(json: any, status: number, fallback: string): string {
  try {
    const msg = json?.message ?? json?.msg ?? json?.error_description
    if (msg) return String(msg)
    if (json?.error_type) return `${json.error_type}: ${fallback}`
  } catch {
    /* ignore */
  }
  if (status === 401) return "API 키가 올바르지 않습니다. REST API 키를 확인해 주세요."
  if (status === 403) return "API 사용 권한이 없습니다. 카카오 콘솔에서 로컬 API가 활성화돼 있는지 확인해 주세요."
  return fallback
}

/** 키워드(장소) 검색 - 성북구 → 성북구, 성북구청, 성북구보건소 등 여러 결과 (Kakao Local REST API) */
export async function searchAddress(query: string): Promise<{ data?: AddressSearchItem[]; error?: string }> {
  const key = getKakaoRestKey()
  if (!key) return { error: REST_KEY_MESSAGE }
  const q = (query ?? "").trim()
  if (!q) return { data: [] }

  try {
    const res = await fetch(
      `${KAKAO_BASE}/search/keyword.json?query=${encodeURIComponent(q)}&size=15`,
      { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" }
    )
    const json = await res.json()
    if (!res.ok) {
      return { error: parseKakaoErrorFromBody(json, res.status, "장소 검색 실패") }
    }
    if (json.error_type) return { error: json.message ?? "장소 검색 실패" }
    const list = (json.documents ?? []).slice(0, 15).map((d: any) => ({
      address: d.address_name ?? "",
      lat: Number(d.y) || 0,
      lng: Number(d.x) || 0,
      placeName: d.place_name ? String(d.place_name).trim() : undefined,
    }))
    return { data: list }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "장소 검색 중 오류가 발생했습니다." }
  }
}

/** 좌표 → 주소 (현재 위치용, WGS84. REST API 키 필요) */
export async function getAddressFromCoords(
  lat: number,
  lng: number
): Promise<{ address?: string; error?: string }> {
  const key = getKakaoRestKey()
  if (!key) return { error: REST_KEY_MESSAGE }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: "좌표가 올바르지 않습니다." }

  try {
    const res = await fetch(
      `${KAKAO_BASE}/geo/coord2address.json?x=${lng}&y=${lat}&input_coord=WGS84`,
      { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" }
    )
    const json = await res.json()
    if (!res.ok) {
      return { error: parseKakaoErrorFromBody(json, res.status, "좌표 변환 실패") }
    }
    if (json.error_type) return { error: json.message ?? "좌표 변환 실패" }
    const doc = json.documents?.[0]
    const address =
      doc?.road_address?.address_name ?? doc?.address?.address_name ?? null
    if (!address) return { error: "해당 좌표의 주소를 찾을 수 없습니다." }
    return { address }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "좌표 변환 중 오류가 발생했습니다." }
  }
}
