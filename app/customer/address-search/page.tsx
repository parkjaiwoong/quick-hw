"use client"

import { useState, Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Search, Navigation, Bookmark, ChevronDown, ChevronUp } from "lucide-react"
import { searchAddress, getAddressFromCoords, type AddressSearchItem } from "@/lib/actions/address"
import { getSavedAddresses, type SavedAddress } from "@/lib/actions/saved-addresses"

function AddressSearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = (searchParams.get("type") === "delivery" ? "delivery" : "pickup") as "pickup" | "delivery"
  const returnTo = searchParams.get("returnTo") || "/customer/new-delivery"

  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [list, setList] = useState<AddressSearchItem[]>([])
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)

  const title = type === "pickup" ? "출발지 주소 조회" : "도착지 주소 조회"

  async function loadSaved() {
    setSavedLoading(true)
    const res = await getSavedAddresses(type)
    setSavedAddresses(res.data ?? [])
    setSavedLoading(false)
  }

  useEffect(() => {
    if (savedOpen) loadSaved()
  }, [savedOpen])

  function buildReturnUrl(item: { address: string; lat: number; lng: number }) {
    const u = new URL(returnTo, window.location.origin)
    if (type === "pickup") {
      u.searchParams.set("pickupAddress", item.address)
      u.searchParams.set("pickupLat", String(item.lat))
      u.searchParams.set("pickupLng", String(item.lng))
    } else {
      u.searchParams.set("deliveryAddress", item.address)
      u.searchParams.set("deliveryLat", String(item.lat))
      u.searchParams.set("deliveryLng", String(item.lng))
    }
    return u.pathname + u.search
  }

  async function handleSearch() {
    setError("")
    setList([])
    const q = query.trim()
    if (!q) {
      setError("검색어를 입력하세요.")
      return
    }
    setLoading(true)
    const res = await searchAddress(q)
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setList(res.data ?? [])
    if ((res.data?.length ?? 0) === 0) setError("검색 결과가 없습니다.")
  }

  async function handleCurrentLocation() {
    if (type !== "pickup") return
    setError("")
    setCurrentLocationLoading(true)
    try {
      const pos = await new Promise<GeolocationPosition>((ok, err) => {
        navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 10000 })
      })
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      const res = await getAddressFromCoords(lat, lng)
      if (res.error) {
        setError(res.error)
        setCurrentLocationLoading(false)
        return
      }
      router.push(buildReturnUrl({ address: res.address!, lat, lng }))
      return
    } catch {
      setError("현재 위치를 가져올 수 없습니다. 주소 검색을 이용해 주세요.")
    }
    setCurrentLocationLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              {title}
            </CardTitle>
            <CardDescription>
              주소를 검색하거나 {type === "pickup" ? "현재 위치를 선택하세요." : "결과에서 주소를 선택하세요."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2 border-dashed"
              onClick={() => setSavedOpen(!savedOpen)}
            >
              <Bookmark className="h-4 w-4" />
              {savedOpen ? "내가 등록한 주소 접기" : "내가 등록한 주소 보기"}
              {savedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {savedOpen && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                {savedLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-2">불러오는 중…</p>
                ) : savedAddresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    등록된 주소가 없습니다.{" "}
                    <Link href="/customer/saved-addresses" className="text-primary underline">
                      자주 쓰는 주소 등록
                    </Link>
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {savedAddresses.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left rounded-md hover:bg-muted transition-colors"
                          onClick={() => router.push(buildReturnUrl({ address: item.address, lat: item.lat, lng: item.lng }))}
                        >
                          <span className="font-medium text-sm block">{item.label}</span>
                          <span className="text-xs text-muted-foreground truncate block">{item.address}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {type === "pickup" && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={handleCurrentLocation}
                disabled={currentLocationLoading}
              >
                <Navigation className="h-4 w-4" />
                {currentLocationLoading ? "위치 조회 중…" : "현재 위치로 설정"}
              </Button>
            )}

            <div className="space-y-2">
              <Label htmlFor="query">주소 검색</Label>
              <div className="flex gap-2">
                <Input
                  id="query"
                  placeholder="동, 도로명, 건물명 등"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
                />
                <Button type="button" onClick={handleSearch} disabled={loading}>
                  <Search className="h-4 w-4" />
                  조회
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {loading && <p className="text-sm text-muted-foreground">검색 중…</p>}

            {list.length > 0 && (
              <ul className="border rounded-lg divide-y">
                {list.map((item, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(buildReturnUrl(item))}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {item.placeName ? `${item.placeName} (${item.address})` : item.address}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Link href="/customer/saved-addresses" className="text-sm text-primary hover:underline">
            자주 쓰는 주소 등록·관리
          </Link>
          <Button type="button" variant="ghost" onClick={() => router.push(returnTo)}>
            배송 요청으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  )
}

function AddressSearchFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardContent className="py-12 text-center text-muted-foreground">
          주소 조회 화면을 불러오는 중…
        </CardContent>
      </Card>
    </div>
  )
}

export default function AddressSearchPage() {
  return (
    <Suspense fallback={<AddressSearchFallback />}>
      <AddressSearchContent />
    </Suspense>
  )
}
