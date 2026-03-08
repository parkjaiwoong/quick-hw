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
 * 모바일: 카카오맵 앱 (kakaomap://route). Android: intent로 미설치 시 구글맵 fallback.
 * PC/미지원: 구글맵.
 */
function getMapUrls(
  address: string,
  coords: { lat: number; lng: number } | null | undefined
): { kakao: string | null; google: string } {
  if (!address && !coords) return { kakao: null, google: "" }
  const dest = coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(address)
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`

  if (typeof navigator === "undefined") return { kakao: null, google: googleUrl }
  const ua = navigator.userAgent || ""
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isMobile = isAndroid || isIOS
  if (isMobile && coords) {
    const ep = `${coords.lat},${coords.lng}`
    const kakaoUrl = `kakaomap://route?ep=${ep}&by=car`
    if (isAndroid) {
      const intent = `intent://route?ep=${ep}&by=car#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=${encodeURIComponent(googleUrl)};end`
      return { kakao: intent, google: googleUrl }
    }
    return { kakao: kakaoUrl, google: googleUrl }
  }
  return { kakao: null, google: googleUrl }
}

/**
 * 주소 셀: 클릭 시 클립보드 복사, 지도 링크 (모바일→카카오맵, 구글맵 보조)
 */
export function AddressWithKakaoMap({ address, coords }: AddressWithKakaoMapProps) {
  const [copied, setCopied] = useState(false)
  const urls = getMapUrls(address, coords)

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

  if (!address) return <span className="text-muted-foreground">-</span>

  const primaryUrl = urls.kakao ?? urls.google

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
      {primaryUrl && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            href={primaryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <MapPin className="h-3.5 w-3.5" />
            {urls.kakao ? "카카오맵 길찾기" : "차량 길찾기"}
          </a>
          {urls.kakao && urls.google && (
            <a
              href={urls.google}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
            >
              구글맵
            </a>
          )}
        </div>
      )}
    </div>
  )
}
