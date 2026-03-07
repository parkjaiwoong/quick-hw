"use client"

import { useState } from "react"
import { Copy, MapPin, Check } from "lucide-react"

interface AddressWithTmapProps {
  address: string
  /** { lat, lng } for TMAP navigation */
  coords?: { lat: number; lng: number } | null
}

/**
 * 주소 셀: 클릭 시 클립보드 복사, TMAP 링크
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
      // fallback for older browsers
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

  const tmapUrl = (() => {
    if (!address || !coords) return null
    const name = encodeURIComponent(address)
    return `tmap://route?goalname=${name}&goalx=${coords.lng}&goaly=${coords.lat}`
  })()

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
      {tmapUrl && (
        <a
          href={tmapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <MapPin className="h-3.5 w-3.5" />
          TMAP으로 길찾기
        </a>
      )}
    </div>
  )
}
