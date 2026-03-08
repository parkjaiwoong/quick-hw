"use client"

import { useState } from "react"
import { Copy, MapPin, Check } from "lucide-react"

interface AddressWithTmapProps {
  address: string
  /** { lat, lng } for map navigation */
  coords?: { lat: number; lng: number } | null
}

/**
 * tmap:// 은 브라우저에서 ERR_UNKNOWN_URL_SCHEME 발생.
 * Android: intent URL (TMAP 앱 → 미설치 시 구글맵 fallback)
 * 기타: 구글맵 URL 사용 (브라우저에서 항상 동작)
 */
function getMapUrl(address: string, coords: { lat: number; lng: number } | null | undefined) {
  if (!address && !coords) return null
  const dest = coords ? `${coords.lat},${coords.lng}` : encodeURIComponent(address)
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`

  if (typeof navigator === "undefined") return googleUrl
  const ua = navigator.userAgent || ""
  const isAndroid = /Android/i.test(ua)
  if (isAndroid && coords) {
    const name = encodeURIComponent(address || "목적지")
    const intent = `intent://route?goalname=${name}&goalx=${coords.lng}&goaly=${coords.lat}#Intent;scheme=tmap;package=com.skt.tmap.ku;S.browser_fallback_url=${encodeURIComponent(googleUrl)};end`
    return intent
  }
  return googleUrl
}

/**
 * 주소 셀: 클릭 시 클립보드 복사, 지도 앱 링크 (Android→TMAP/구글맵, 기타→구글맵)
 */
export function AddressWithTmap({ address, coords }: AddressWithTmapProps) {
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
          지도로 길찾기
        </a>
      )}
    </div>
  )
}
