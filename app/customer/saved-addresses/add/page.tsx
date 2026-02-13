"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { addSavedAddress } from "@/lib/actions/saved-addresses"

function AddSavedAddressContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = (searchParams.get("type") === "delivery" ? "delivery" : "pickup") as "pickup" | "delivery"
  const [label, setLabel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const address =
    type === "pickup"
      ? searchParams.get("pickupAddress")
      : searchParams.get("deliveryAddress")
  const lat =
    type === "pickup"
      ? Number(searchParams.get("pickupLat"))
      : Number(searchParams.get("deliveryLat"))
  const lng =
    type === "pickup"
      ? Number(searchParams.get("pickupLng"))
      : Number(searchParams.get("deliveryLng"))

  const isValid = address && Number.isFinite(lat) && Number.isFinite(lng)

  useEffect(() => {
    if (address && !label.trim()) {
      setLabel(address.slice(0, 50))
    }
  }, [address])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || !label.trim()) return
    setLoading(true)
    setError("")
    const res = await addSavedAddress({
      label: label.trim(),
      address,
      lat,
      lng,
      addressType: type,
    })
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.push("/customer/saved-addresses")
  }

  if (!isValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>주소를 먼저 선택하세요</CardTitle>
              <CardDescription>
                주소 검색에서 위치를 선택한 뒤 이 페이지로 돌아와야 합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/customer/address-search?type=${type}&returnTo=/customer/saved-addresses/add?type=${type}`}>
                  주소 검색하기
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Button variant="ghost" asChild>
            <Link href="/customer/saved-addresses">← 저장 주소 목록</Link>
          </Button>
        </div>
      </div>
    )
  }

  const typeLabel = type === "pickup" ? "출발지" : "도착지"

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/customer/saved-addresses">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">{typeLabel}로 저장</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-blue-600" />
              선택한 주소
            </CardTitle>
            <CardDescription className="text-sm break-words">
              {address}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">이름 (예: 집, 회사)</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="저장할 이름을 입력하세요"
                  maxLength={100}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "저장 중…" : "저장하기"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AddFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4 flex items-center justify-center">
      <p className="text-muted-foreground">불러오는 중…</p>
    </div>
  )
}

export default function AddSavedAddressPage() {
  return (
    <Suspense fallback={<AddFallback />}>
      <AddSavedAddressContent />
    </Suspense>
  )
}
