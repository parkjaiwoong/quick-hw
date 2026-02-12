"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

declare global {
  interface Window {
    kakao: any
  }
}

export interface AddressMapPickerResult {
  address: string
  lat: number
  lng: number
}

interface AddressMapPickerProps {
  /** "출발지" | "도착지" 등 라벨 */
  label: string
  /** 현재 주소 (controlled) */
  value?: string
  /** 현재 위도 (controlled) */
  lat?: string
  /** 현재 경도 (controlled) */
  lng?: string
  /** 지도에서 선택 또는 검색 시 콜백 */
  onSelect: (result: AddressMapPickerResult) => void
  /** 지도 높이 (px) */
  mapHeight?: number
  /** true면 좌표 없을 때 현재 위치를 기본으로 사용 (출발지 등) */
  defaultToCurrentLocation?: boolean
}

const KAKAO_MAP_SCRIPT_ID = "kakao-maps-sdk"
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }

function loadKakaoMapScript(appKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("window undefined"))
  if (window.kakao?.maps) return Promise.resolve()
  const existing = document.getElementById(KAKAO_MAP_SCRIPT_ID)
  if (existing) {
    if (window.kakao?.maps) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const maxWait = 15000
      const start = Date.now()
      const poll = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(poll)
          resolve()
        } else if (Date.now() - start > maxWait) {
          clearInterval(poll)
          reject(new Error("Kakao Map script load timeout"))
        }
      }, 50)
      existing.addEventListener("load", () => {
        if (window.kakao?.maps) {
          clearInterval(poll)
          resolve()
        }
      })
      existing.addEventListener("error", () => {
        clearInterval(poll)
        reject(new Error("Kakao script load failed"))
      })
    })
  }
  const key = appKey.trim()
  if (!key) return Promise.reject(new Error("Empty API key"))
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.id = KAKAO_MAP_SCRIPT_ID
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => resolve())
    }
    script.onerror = () =>
      reject(
        new Error(
          "Kakao Map script failed to load. Register this site in Kakao Console (Platform > Web > Site domain) and check your JavaScript key."
        )
      )
    document.head.appendChild(script)
  })
}

export function AddressMapPicker({
  label,
  value = "",
  lat = "",
  lng = "",
  onSelect,
  mapHeight = 280,
  defaultToCurrentLocation = false,
}: AddressMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  const appKey = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_KAKAO_MAP_KEY : ""

  useEffect(() => {
    if (!appKey || !containerRef.current) return

    setError(null)
    setIsLoading(true)

    loadKakaoMapScript(appKey)
      .then(() => {
        const kakao = window.kakao
        const centerLat = lat ? parseFloat(lat) : DEFAULT_CENTER.lat
        const centerLng = lng ? parseFloat(lng) : DEFAULT_CENTER.lng
        const center = new kakao.maps.LatLng(
          Number.isFinite(centerLat) ? centerLat : DEFAULT_CENTER.lat,
          Number.isFinite(centerLng) ? centerLng : DEFAULT_CENTER.lng
        )

        const map = new kakao.maps.Map(containerRef.current, {
          center,
          level: 4,
        })
        mapRef.current = map

        // 클릭 시 해당 위치로 마커 이동 + 좌표→주소 변환 후 onSelect
        kakao.maps.event.addListener(map, "click", (mouseEvent: any) => {
          const latLng = mouseEvent.latLng
          const lat = latLng.getLat()
          const lng = latLng.getLng()

          if (markerRef.current) {
            markerRef.current.setMap(null)
          }
          const marker = new kakao.maps.Marker({ position: latLng })
          marker.setMap(map)
          markerRef.current = marker

          const geocoder = new kakao.maps.services.Geocoder()
          geocoder.coord2Address(lng, lat, (result: any[], status: string) => {
            const address =
              status === kakao.maps.services.Status.OK && result?.[0]
                ? result[0].address?.address_name || result[0].road_address?.address_name || ""
                : ""
            onSelect({
              address: address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
              lat,
              lng,
            })
          })
        })

        // 기존 좌표가 있으면 마커 표시
        const hasCoords = lat && lng && Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng))
        if (hasCoords) {
          const latNum = parseFloat(lat)
          const lngNum = parseFloat(lng)
          const pos = new kakao.maps.LatLng(latNum, lngNum)
          const marker = new kakao.maps.Marker({ position: pos })
          marker.setMap(map)
          markerRef.current = marker
        } else if (defaultToCurrentLocation && "geolocation" in navigator) {
          // 출발지 등: 현재 위치를 기본으로 설정
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const currentLat = position.coords.latitude
              const currentLng = position.coords.longitude
              const pos = new kakao.maps.LatLng(currentLat, currentLng)
              map.setCenter(pos)
              map.setLevel(3)
              if (markerRef.current) markerRef.current.setMap(null)
              const marker = new kakao.maps.Marker({ position: pos })
              marker.setMap(map)
              markerRef.current = marker
              const geocoder = new kakao.maps.services.Geocoder()
              geocoder.coord2Address(currentLng, currentLat, (result: any[], status: string) => {
                const address =
                  status === kakao.maps.services.Status.OK && result?.[0]
                    ? result[0].address?.address_name || result[0].road_address?.address_name || ""
                    : ""
                onSelect({
                  address: address || `현재 위치 (${currentLat.toFixed(5)}, ${currentLng.toFixed(5)})`,
                  lat: currentLat,
                  lng: currentLng,
                })
              })
            },
            () => {
              // 사용자가 거부하거나 실패 시 기본 중심 유지
            }
          )
        }
      })
      .catch((err) => {
        if (!appKey?.trim()) {
          setError("카카오맵 API 키를 설정해주세요. (.env.local의 NEXT_PUBLIC_KAKAO_MAP_KEY)")
        } else {
          setError(
            "카카오맵 스크립트를 불러오지 못했습니다. 카카오 개발자 콘솔 → 앱 설정 → 플랫폼 → Web에서 '사이트 도메인'에 http://localhost:3000 을 추가했는지, JavaScript 키가 맞는지 확인해주세요."
          )
        }
        console.error("Kakao Map load error:", err)
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current = null
      }
    }
  }, [appKey])

  const handleSearch = () => {
    if (!searchQuery.trim() || !window.kakao?.maps?.services) return

    const ps = new window.kakao.maps.services.Places()
    ps.keywordSearch(searchQuery.trim(), (data: any[], status: string) => {
      if (status !== window.kakao.maps.services.Status.OK || !data?.[0]) return
      const item = data[0]
      const lat = parseFloat(item.y)
      const lng = parseFloat(item.x)
      const address = item.address_name || item.road_address_name || item.place_name || ""
      onSelect({ address, lat, lng })

      if (mapRef.current) {
        const center = new window.kakao.maps.LatLng(lat, lng)
        mapRef.current.setCenter(center)
        mapRef.current.setLevel(3)
        if (markerRef.current) {
          markerRef.current.setMap(null)
        }
        const marker = new window.kakao.maps.Marker({ position: center })
        marker.setMap(mapRef.current)
        markerRef.current = marker
      }
    })
  }

  if (!appKey) {
    return (
      <div className="space-y-2">
        <Label>{label} (지도)</Label>
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          .env.local에 NEXT_PUBLIC_KAKAO_MAP_KEY(카카오 개발자 콘솔 JavaScript 키)를 추가하면 지도에서 위치를 선택할 수 있습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>{label} — 지도에서 선택 또는 주소 검색</Label>
      <div className="flex gap-2">
        <Input
          placeholder="주소 또는 장소 검색 (예: 강남역)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="icon" onClick={handleSearch} aria-label="검색">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-lg border bg-muted/30"
        style={{ height: mapHeight }}
      />
      {isLoading && (
        <p className="text-xs text-muted-foreground">지도 로딩 중...</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <p className="text-xs text-muted-foreground">
        지도를 클릭하면 해당 위치가 자동으로 설정됩니다. 주소 검색 후 선택해도 됩니다.
      </p>
    </div>
  )
}
