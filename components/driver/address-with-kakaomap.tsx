"use client"

import { useState } from "react"
import { Copy, MapPin, Check } from "lucide-react"

interface AddressWithKakaoMapProps {
  address: string
  /** { lat, lng } for map navigation */
  coords?: { lat: number; lng: number } | null
}

/**
 * 차량/오토바이 길찾기 (대중교통 제외).
 * kakaomap://route = 카카오맵 앱 자동차 경로안내. Android: intent, 미설치 시 카카오맵 웹 fallback.
 */
function getMapUrl(address: string, coords: { lat: number; lng: number } | null | undefined) {
  if (!address && !coords) return null

  // 카카오맵 웹: 좌표 있으면 /link/to/장소명,위도,경도, 없으면 검색
  const kakaoWebUrl = coords
    ? `https://map.kakao.com/link/to/${encodeURIComponent(address || "목적지")},${coords.lat},${coords.lng}`
    : `https://map.kakao.com/?q=${encodeURIComponent(address)}`

  if (typeof navigator === "undefined") return kakaoWebUrl
  const ua = navigator.userAgent || ""
  const isAndroid = /Android/i.test(ua)
  if (isAndroid && coords) {
    const ep = `${coords.lat},${coords.lng}`
    const intent = `intent://route?ep=${ep}&by=car#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=${encodeURIComponent(kakaoWebUrl)};end`
    return intent
  }
  return kakaoWebUrl
}

/**
 * 주소 셀: 클릭 시 클립보드 복사, 지도 앱 링크 (Android→카카오맵/웹, 기타→카카오맵 웹)
 */
export function AddressWithKakaoMap({ address, coords }: AddressWithKakaoMapProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      const ta = document.createElement("textarea")
      ta.value = address
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const mapUrl = getMapUrl(address, coords)

  if (!address) return <span className="text-muted-foreground">-</span>

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className="text-left hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 -my-0.5 transition flex items-center gap-2 group"
        title="클릭하여 주소 복사"
      >
        <span className="flex-1 min-w-0">{address}</span>
        {copied ? (
          <Check className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
        )}
      </button>
      {mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <MapPin className="h-3.5 w-3.5" />
          차량 길찾기
        </a>
      )}
    </div>
  )
}
