"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

interface AddressWithKakaoMapProps {
  address: string
  /** { lat, lng } - reserved for future use (e.g. map) */
  coords?: { lat: number; lng: number } | null
}

/**
 * 주소 셀: 클릭 시 클립보드 복사. 오른쪽 끝에 복사 가능 표시.
 */
export function AddressWithKakaoMap({ address, coords: _coords }: AddressWithKakaoMapProps) {
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

  if (!address) return <span className="text-muted-foreground">-</span>

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="w-full text-left hover:bg-muted/50 rounded px-1 -mx-1 py-0.5 -my-0.5 transition flex items-center gap-2 group"
      title="클릭하여 주소 복사"
    >
      <span className="flex-1 min-w-0">{address}</span>
      <span className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-600" />
            <span className="text-green-600">복사됨</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>클릭하여 복사</span>
          </>
        )}
      </span>
    </button>
  )
}
