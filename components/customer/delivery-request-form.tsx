"use client"

import type React from "react"

import { useState, useEffect, useRef, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createDelivery } from "@/lib/actions/deliveries"
import { getAddressFromCoords } from "@/lib/actions/address"
import { calculateDeliveryFee } from "@/lib/pricing"
import { useRouter } from "next/navigation"
import { MapPin, Package, Check, AlertCircle, Bike, Car, Truck, Clock, Calendar, FileText, Box } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

interface DeliveryRequestFormProps {
  userProfile: any
  pricingConfig?: {
    base_fee?: number
    per_km_fee?: number
  } | null
  initialPickupAddress?: string
  initialPickupLat?: string
  initialPickupLng?: string
  initialDeliveryAddress?: string
  initialDeliveryLat?: string
  initialDeliveryLng?: string
  initialPickupContactName?: string
  initialPickupContactPhone?: string
  initialPickupNotes?: string
  initialDeliveryContactName?: string
  initialDeliveryContactPhone?: string
  initialDeliveryNotes?: string
}

const NEW_DELIVERY_PATH = "/customer/new-delivery"
const ADDRESS_SEARCH_PATH = "/customer/address-search"

export function DeliveryRequestForm({
  userProfile,
  pricingConfig,
  initialPickupAddress,
  initialPickupLat,
  initialPickupLng,
  initialDeliveryAddress,
  initialDeliveryLat,
  initialDeliveryLng,
  initialPickupContactName,
  initialPickupContactPhone,
  initialPickupNotes,
  initialDeliveryContactName,
  initialDeliveryContactPhone,
  initialDeliveryNotes,
}: DeliveryRequestFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [itemType, setItemType] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [itemDescription, setItemDescription] = useState("")
  const [pickupAddress, setPickupAddress] = useState(initialPickupAddress ?? "")
  const [pickupLat, setPickupLat] = useState(initialPickupLat ?? "")
  const [pickupLng, setPickupLng] = useState(initialPickupLng ?? "")
  const [deliveryAddress, setDeliveryAddress] = useState(initialDeliveryAddress ?? "")
  const [deliveryLat, setDeliveryLat] = useState(initialDeliveryLat ?? "")
  const [deliveryLng, setDeliveryLng] = useState(initialDeliveryLng ?? "")
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null)
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null)
  const [customerAmount, setCustomerAmount] = useState<number | null>(null)
  const [vehicleType, setVehicleType] = useState<"motorcycle" | "car" | "truck">("motorcycle")
  const [deliveryOption, setDeliveryOption] = useState<"immediate" | "scheduled">("immediate")
  const [urgency, setUrgency] = useState<"standard" | "express">("standard")
  const [scheduledPickupAt, setScheduledPickupAt] = useState("")
  const [pickupDefaultLoading, setPickupDefaultLoading] = useState(false)
  const defaultPickupTried = useRef(false)
  const baseFee = Number(pricingConfig?.base_fee ?? 4000)
  const perKmFee = Number(pricingConfig?.per_km_fee ?? 1000)
  const includedDistanceKm = 2

  /** 출발지 기본값: URL에서 넘어온 값이 없으면 현재 위치로 설정 (사용자가 주소 조회로 바꿀 수 있음) */
  useEffect(() => {
    if (defaultPickupTried.current) return
    if (initialPickupAddress?.trim() || initialPickupLat?.trim() || initialPickupLng?.trim()) return
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    defaultPickupTried.current = true
    setPickupDefaultLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const res = await getAddressFromCoords(lat, lng)
        setPickupDefaultLoading(false)
        if (res.address) {
          startTransition(() => {
            setPickupAddress(res.address)
            setPickupLat(String(lat))
            setPickupLng(String(lng))
          })
        }
      },
      () => setPickupDefaultLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [initialPickupAddress, initialPickupLat, initialPickupLng])

  /** 원화 표시 (천 단위 콤마) */
  const formatWon = (n: number) => n.toLocaleString("ko-KR")

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c * 10) / 10
  }

  // 거리·물품종류 변경 시 요금 계산 (startTransition으로 INP 개선: 입력 필드 반응성 우선)
  useEffect(() => {
    const pLat = parseFloat(pickupLat)
    const pLng = parseFloat(pickupLng)
    const dLat = parseFloat(deliveryLat)
    const dLng = parseFloat(deliveryLng)
    if (Number.isFinite(pLat) && Number.isFinite(pLng) && Number.isFinite(dLat) && Number.isFinite(dLng)) {
      const distance = calculateDistance(pLat, pLng, dLat, dLng)
      if (distance !== null) {
        const fee = calculateDeliveryFee({
          baseFee,
          perKmFee,
          includedDistanceKm,
          distanceKm: distance,
          itemType: itemType || undefined,
        })
        startTransition(() => {
          setCalculatedDistance(distance)
          setEstimatedFee(fee)
          setCustomerAmount(fee)
        })
      } else {
        startTransition(() => {
          setCalculatedDistance(null)
          setEstimatedFee(null)
          setCustomerAmount(null)
        })
      }
    } else {
      startTransition(() => {
        setCalculatedDistance(null)
        setEstimatedFee(null)
        setCustomerAmount(null)
      })
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, itemType, baseFee, perKmFee, includedDistanceKm])

  // 주소 조회 화면에서 돌아왔을 때 URL로 전달된 주소 반영 (비긴급 업데이트로 INP 개선)
  useEffect(() => {
    startTransition(() => {
      if (initialPickupAddress != null) setPickupAddress(initialPickupAddress)
      if (initialPickupLat != null) setPickupLat(initialPickupLat)
      if (initialPickupLng != null) setPickupLng(initialPickupLng)
      if (initialDeliveryAddress != null) setDeliveryAddress(initialDeliveryAddress)
      if (initialDeliveryLat != null) setDeliveryLat(initialDeliveryLat)
      if (initialDeliveryLng != null) setDeliveryLng(initialDeliveryLng)
    })
  }, [initialPickupAddress, initialPickupLat, initialPickupLng, initialDeliveryAddress, initialDeliveryLat, initialDeliveryLng])


  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // INP 개선: 핸들러에서 무거운 작업을 하지 않고 한 틱 미룸 → UI(로딩 표시)가 먼저 그려짐
    startTransition(() => {
      setIsLoading(true)
      setError("")
    })
    const form = e.currentTarget
    queueMicrotask(async () => {
      if (deliveryOption === "scheduled" && !scheduledPickupAt.trim()) {
        setError("예약 픽업을 선택했을 경우 픽업 희망 일시를 입력해주세요.")
        setIsLoading(false)
        return
      }

      const formData = new FormData(form)
      const data = {
        pickupAddress: formData.get("pickupAddress") as string,
        pickupLat: Number.parseFloat(formData.get("pickupLat") as string) || 37.5665,
        pickupLng: Number.parseFloat(formData.get("pickupLng") as string) || 126.978,
        pickupContactName: formData.get("pickupContactName") as string,
        pickupContactPhone: formData.get("pickupContactPhone") as string,
        pickupNotes: formData.get("pickupNotes") as string,

        deliveryAddress: formData.get("deliveryAddress") as string,
        deliveryLat: Number.parseFloat(formData.get("deliveryLat") as string) || 37.5665,
        deliveryLng: Number.parseFloat(formData.get("deliveryLng") as string) || 126.978,
        deliveryContactName: formData.get("deliveryContactName") as string,
        deliveryContactPhone: formData.get("deliveryContactPhone") as string,
        deliveryNotes: formData.get("deliveryNotes") as string,

        itemType: itemType,
        itemDescription: (formData.get("itemDescription") as string) || undefined,
        paymentMethod: (formData.get("paymentMethod") as string) || paymentMethod,
        customerAmount: (() => {
          const raw = (formData.get("customerAmount") as string)?.replace(/,/g, "") ?? ""
          const num = Number.parseFloat(raw)
          return Number.isFinite(num) ? Math.round(num) : undefined
        })(),
        deliveryOption: (formData.get("deliveryOption") as string) || "immediate",
        vehicleType: (formData.get("vehicleType") as string) || "motorcycle",
        urgency: (formData.get("urgency") as string) || "standard",
        scheduledPickupAt: (formData.get("scheduledPickupAt") as string) || undefined,
      }

      const result = await createDelivery(data)

      if (result.error) {
        setError(result.error)
        setIsLoading(false)
      } else {
        const id = result.delivery?.id
        if (!id) {
          setError("배송 정보를 불러올 수 없습니다.")
          setIsLoading(false)
          return
        }
        const method = (data.paymentMethod || paymentMethod || "").toLowerCase()
        startTransition(() => {
          if (method === "card" || method === "bank_transfer") {
            router.push(`/customer/delivery/${id}/pay`)
          } else {
            router.push(`/customer/delivery/${id}`)
          }
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* 법적 고지 */}
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>요금 안내:</strong> 거리 + 물품 종류 가산으로 자동 산정됩니다.
          기본요금 {formatWon(baseFee)}원, {includedDistanceKm}km 초과분 km당 {formatWon(perKmFee)}원,
          소형/중형/대형·무게 구간·크기(가로+세로+높이)에 따라 가산료가 추가됩니다.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              출발지
            </CardTitle>
            <CardDescription>물품을 픽업할 장소 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>출발지 주소 *</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-foreground min-h-[40px] flex items-center">
                  {pickupDefaultLoading ? "현재 위치 불러오는 중..." : pickupAddress || "주소 조회에서 선택하세요"}
                </div>
                <Link
                  href={`${ADDRESS_SEARCH_PATH}?type=pickup&returnTo=${encodeURIComponent(
                    deliveryAddress
                      ? `${NEW_DELIVERY_PATH}?deliveryAddress=${encodeURIComponent(deliveryAddress)}&deliveryLat=${deliveryLat}&deliveryLng=${deliveryLng}`
                      : NEW_DELIVERY_PATH
                  )}`}
                  className="shrink-0"
                >
                  <Button type="button" variant="outline" size="sm">
                    주소 조회
                  </Button>
                </Link>
              </div>
              <input type="hidden" name="pickupAddress" value={pickupAddress} required />
              <input type="hidden" name="pickupLat" value={pickupLat} />
              <input type="hidden" name="pickupLng" value={pickupLng} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupContactName">픽업 담당자</Label>
              <Input
                id="pickupContactName"
                name="pickupContactName"
                placeholder="홍길동"
                defaultValue={initialPickupContactName ?? userProfile?.full_name ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupContactPhone">픽업 연락처</Label>
              <Input
                id="pickupContactPhone"
                name="pickupContactPhone"
                type="tel"
                placeholder="010-1234-5678"
                defaultValue={initialPickupContactPhone ?? userProfile?.phone ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupNotes">픽업 메모 (선택)</Label>
              <Textarea
                id="pickupNotes"
                name="pickupNotes"
                placeholder="1층 로비에서 픽업"
                rows={2}
                defaultValue={initialPickupNotes ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              도착지
            </CardTitle>
            <CardDescription>물품을 배송받을 장소 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>도착지 주소 *</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-foreground min-h-[40px] flex items-center">
                  {deliveryAddress || "주소 조회에서 선택하세요"}
                </div>
                <Link
                  href={`${ADDRESS_SEARCH_PATH}?type=delivery&returnTo=${encodeURIComponent(
                    pickupAddress
                      ? `${NEW_DELIVERY_PATH}?pickupAddress=${encodeURIComponent(pickupAddress)}&pickupLat=${pickupLat}&pickupLng=${pickupLng}`
                      : NEW_DELIVERY_PATH
                  )}`}
                  className="shrink-0"
                >
                  <Button type="button" variant="outline" size="sm">
                    주소 조회
                  </Button>
                </Link>
              </div>
              <input type="hidden" name="deliveryAddress" value={deliveryAddress} required />
              <input type="hidden" name="deliveryLat" value={deliveryLat} />
              <input type="hidden" name="deliveryLng" value={deliveryLng} />
            </div>
            
            {/* 거리 및 예상 요금 표시 */}
            {calculatedDistance !== null && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">계산된 거리:</span>
                  <span className="text-lg font-bold text-blue-700">{calculatedDistance.toFixed(1)} km</span>
                </div>
                {estimatedFee !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-900">예상 요금:</span>
                    <span className="text-lg font-bold text-blue-700">{formatWon(estimatedFee)}원</span>
                  </div>
                )}
                <p className="text-xs text-blue-600 mt-2">
                  거리·물품 종류 기준 자동 산정 요금입니다.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="deliveryContactName">수령인</Label>
              <Input
                id="deliveryContactName"
                name="deliveryContactName"
                placeholder="김철수"
                defaultValue={initialDeliveryContactName ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryContactPhone">수령인 연락처</Label>
              <Input
                id="deliveryContactPhone"
                name="deliveryContactPhone"
                type="tel"
                placeholder="010-9876-5432"
                defaultValue={initialDeliveryContactPhone ?? ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryNotes">배송 메모 (선택)</Label>
              <Textarea
                id="deliveryNotes"
                name="deliveryNotes"
                placeholder="경비실에 맡겨주세요"
                rows={2}
                defaultValue={initialDeliveryNotes ?? ""}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              배송 옵션
            </CardTitle>
            <CardDescription>차량과 픽업 방식을 선택하세요. 기사가 확인 후 수락합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="mb-3 block">차량 종류</Label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setVehicleType("motorcycle")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all min-w-[100px] ${
                    vehicleType === "motorcycle"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Bike className="h-10 w-10" />
                  <span className="text-sm font-medium">오토바이</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted p-4 opacity-70 min-w-[100px] relative"
                >
                  <Car className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">승용차</span>
                  <span className="text-xs text-amber-600 font-medium">서비스 예정</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted p-4 opacity-70 min-w-[100px]"
                >
                  <Truck className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">트럭</span>
                  <span className="text-xs text-amber-600 font-medium">서비스 예정</span>
                </button>
              </div>
            </div>

            <div>
              <Label className="mb-3 block">픽업 방식</Label>
              <div className="flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setDeliveryOption("immediate")}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                    deliveryOption === "immediate"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Clock className="h-5 w-5" />
                  즉시 픽업
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryOption("scheduled")}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all ${
                    deliveryOption === "scheduled"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Calendar className="h-5 w-5" />
                  예약 픽업
                </button>
              </div>
            </div>

            {deliveryOption === "immediate" && (
              <div>
                <Label className="mb-2 block">예상 시간</Label>
                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setUrgency("standard")}
                    className={`rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                      urgency === "standard"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    기본 (약 3시간 내)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUrgency("express")}
                    className={`rounded-lg border-2 px-4 py-2 text-sm transition-all ${
                      urgency === "express"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                  >
                    급송 (30분 내)
                  </button>
                </div>
              </div>
            )}

            {deliveryOption === "scheduled" && (
              <div className="space-y-2">
                <Label htmlFor="scheduledPickupAt">픽업 희망 일시</Label>
                <Input
                  id="scheduledPickupAt"
                  name="scheduledPickupAt"
                  type="datetime-local"
                  value={scheduledPickupAt}
                  onChange={(e) => setScheduledPickupAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">원하시는 픽업 날짜와 시간을 선택하세요.</p>
              </div>
            )}

            <input type="hidden" name="vehicleType" value={vehicleType} />
            <input type="hidden" name="deliveryOption" value={deliveryOption} />
            <input type="hidden" name="urgency" value={urgency} />
            <input type="hidden" name="scheduledPickupAt" value={scheduledPickupAt} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              물품 정보
            </CardTitle>
            <CardDescription>물품 종류를 선택하면 규격·가격이 적용됩니다. 물품 설명과 전달사항만 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>물품 종류 *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { value: "document", label: "서류", weight: "~1kg", size: "A4 이하", surcharge: 0, Icon: FileText },
                  { value: "small", label: "소형", weight: "~5kg", size: "30cm 이하", surcharge: 500, Icon: Package },
                  { value: "medium", label: "중형", weight: "~10kg", size: "30~60cm", surcharge: 1000, Icon: Package },
                  { value: "large", label: "대형", weight: "~20kg", size: "60cm 이상", surcharge: 2000, Icon: Box },
                ].map(({ value, label, weight, size, surcharge, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setItemType(value)}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50 ${
                      itemType === value ? "border-primary bg-primary/10" : "border-muted"
                    }`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                      <Icon className={`h-8 w-8 text-muted-foreground ${value === "large" ? "h-10 w-10" : ""}`} />
                    </div>
                    <span className="font-medium">{label}</span>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>무게 {weight}</p>
                      <p>길이 {size}</p>
                    </div>
                    <span className="text-xs font-medium text-primary">
                      {surcharge === 0 ? "가산 없음" : `+${formatWon(surcharge)}원`}
                    </span>
                  </button>
                ))}
              </div>
              <input type="hidden" name="itemType" value={itemType} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemDescription">물품 설명 (선택)</Label>
              <Input
                id="itemDescription"
                name="itemDescription"
                placeholder="서류, 선물 등"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              선택한 물품 종류에 따라 예상 요금이 자동 계산됩니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>결제 정보</CardTitle>
            <CardDescription>출발지·도착지 입력 시 결제 금액이 자동 계산됩니다. 필요하면 수정 후 요청하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="paymentMethod">결제 수단</Label>
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                  <Link href="/customer/account-link">계좌/카드 연동</Link>
                </Button>
              </div>
              <Select name="paymentMethod" value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder="결제 수단 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">카드결제</SelectItem>
                  <SelectItem value="bank_transfer">계좌이체</SelectItem>
                  <SelectItem value="cash">현금 (기사 직접 수령)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {estimatedFee !== null && (
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm font-medium text-muted-foreground">자동 계산 금액</p>
                <p className="text-xl font-bold text-foreground">{formatWon(estimatedFee)}원</p>
                <p className="text-xs text-muted-foreground mt-1">
                  거리·물품 종류 기준으로 산정되었습니다.
                  {calculatedDistance !== null && ` (거리 ${calculatedDistance.toFixed(1)}km)`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="customerAmount">결제 금액 (원)</Label>
              <Input
                id="customerAmount"
                name="customerAmount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={estimatedFee !== null ? formatWon(estimatedFee) : "출발지·도착지 입력 시 자동 계산"}
                value={customerAmount !== null && customerAmount !== undefined ? formatWon(customerAmount) : ""}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "")
                  if (raw === "") setCustomerAmount(null)
                  else {
                    const n = Number(raw)
                    setCustomerAmount(Number.isFinite(n) ? Math.round(n) : null)
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                필요하면 위 자동 계산 금액을 확인·수정한 뒤 요청하세요.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
            취소
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !itemType || (deliveryOption === "scheduled" && !scheduledPickupAt.trim())}
            className="flex-1"
          >
            {isLoading ? "요청 중..." : "기사 연결 요청"}
          </Button>
        </div>
      </form>
    </div>
  )
}
