"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createDelivery } from "@/lib/actions/deliveries"
import { useRouter } from "next/navigation"
import { MapPin, Package, Check, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface DeliveryRequestFormProps {
  userProfile: any
  pricingConfig?: {
    base_fee?: number
    per_km_fee?: number
  } | null
}

export function DeliveryRequestForm({ userProfile, pricingConfig }: DeliveryRequestFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [itemType, setItemType] = useState("")
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null)
  const [estimatedFee, setEstimatedFee] = useState<number | null>(null)
  const baseFee = Number(pricingConfig?.base_fee ?? 4000)
  const perKmFee = Number(pricingConfig?.per_km_fee ?? 1000)
  const includedDistanceKm = 2
  
  // 카카오T 픽커 방식 요금 계산
  const calculateEstimatedFee = (distanceKm: number) => {
    const distanceFee = Math.max(0, distanceKm - includedDistanceKm) * perKmFee // 2km 초과분만 추가 요금
    return baseFee + distanceFee
  }
  
  // 거리 자동 계산 함수
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null
    
    // 하버사인 공식
    const R = 6371 // 지구 반지름 (km)
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c
    
    return Math.round(distance * 10) / 10 // 소수점 첫째 자리까지
  }
  
  // 위도/경도 변경 시 거리 자동 계산
  const handleLocationChange = () => {
    const form = document.querySelector('form') as HTMLFormElement
    if (!form) return
    
    const pickupLat = parseFloat((form.querySelector('#pickupLat') as HTMLInputElement)?.value || '0')
    const pickupLng = parseFloat((form.querySelector('#pickupLng') as HTMLInputElement)?.value || '0')
    const deliveryLat = parseFloat((form.querySelector('#deliveryLat') as HTMLInputElement)?.value || '0')
    const deliveryLng = parseFloat((form.querySelector('#deliveryLng') as HTMLInputElement)?.value || '0')
    
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng)
      if (distance !== null) {
        setCalculatedDistance(distance)
        setEstimatedFee(calculateEstimatedFee(distance))
      } else {
        setCalculatedDistance(null)
        setEstimatedFee(null)
      }
    } else {
      setCalculatedDistance(null)
      setEstimatedFee(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)

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
      itemDescription: formData.get("itemDescription") as string,
      itemWeight: Number.parseFloat(formData.get("itemWeight") as string) || undefined,
      packageSize: formData.get("packageSize") as string,
    }

    const result = await createDelivery(data)

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      // 기사 추천 화면으로 이동
      router.push(`/customer/drivers/${result.delivery?.id}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 법적 고지 */}
      <Alert className="border-orange-200 bg-orange-50">
        <AlertCircle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>요금 안내:</strong> 요금은 카카오픽 기준으로 자동 산정됩니다. 
          기본요금 {baseFee.toLocaleString()}원 + {includedDistanceKm}km 초과분 km당 {perKmFee.toLocaleString()}원입니다.
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
              <Label htmlFor="pickupAddress">출발지 주소</Label>
              <Input id="pickupAddress" name="pickupAddress" placeholder="서울시 강남구 테헤란로 123" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupLat">위도 (테스트용)</Label>
                <Input 
                  id="pickupLat" 
                  name="pickupLat" 
                  type="number" 
                  step="any" 
                  placeholder="37.5665"
                  onChange={handleLocationChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupLng">경도 (테스트용)</Label>
                <Input 
                  id="pickupLng" 
                  name="pickupLng" 
                  type="number" 
                  step="any" 
                  placeholder="126.978"
                  onChange={handleLocationChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupContactName">픽업 담당자</Label>
              <Input
                id="pickupContactName"
                name="pickupContactName"
                placeholder="홍길동"
                defaultValue={userProfile?.full_name || ""}
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
                defaultValue={userProfile?.phone || ""}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pickupNotes">픽업 메모 (선택)</Label>
              <Textarea id="pickupNotes" name="pickupNotes" placeholder="1층 로비에서 픽업" rows={2} />
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
              <Label htmlFor="deliveryAddress">도착지 주소</Label>
              <Input id="deliveryAddress" name="deliveryAddress" placeholder="서울시 서초구 서초대로 456" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryLat">위도 (테스트용)</Label>
                <Input 
                  id="deliveryLat" 
                  name="deliveryLat" 
                  type="number" 
                  step="any" 
                  placeholder="37.5012"
                  onChange={handleLocationChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryLng">경도 (테스트용)</Label>
                <Input 
                  id="deliveryLng" 
                  name="deliveryLng" 
                  type="number" 
                  step="any" 
                  placeholder="127.0396"
                  onChange={handleLocationChange}
                />
              </div>
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
                    <span className="text-lg font-bold text-blue-700">{estimatedFee.toLocaleString()}원</span>
                  </div>
                )}
                <p className="text-xs text-blue-600 mt-2">
                  위 금액은 좌표 기준으로 자동 산정된 요금입니다.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="deliveryContactName">수령인</Label>
              <Input id="deliveryContactName" name="deliveryContactName" placeholder="김철수" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryContactPhone">수령인 연락처</Label>
              <Input
                id="deliveryContactPhone"
                name="deliveryContactPhone"
                type="tel"
                placeholder="010-9876-5432"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryNotes">배송 메모 (선택)</Label>
              <Textarea id="deliveryNotes" name="deliveryNotes" placeholder="경비실에 맡겨주세요" rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              물품 정보
            </CardTitle>
            <CardDescription>배송할 물품에 대한 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="itemType">물품 종류 *</Label>
              <Select name="itemType" value={itemType} onValueChange={setItemType} required>
                <SelectTrigger>
                  <SelectValue placeholder="물품 종류를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">서류</SelectItem>
                  <SelectItem value="small">소형 (30cm 이하)</SelectItem>
                  <SelectItem value="medium">중형 (30-60cm)</SelectItem>
                  <SelectItem value="large">대형 (60cm 이상)</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemDescription">물품 설명 (선택)</Label>
              <Input id="itemDescription" name="itemDescription" placeholder="서류, 선물 등" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemWeight">무게 (kg, 선택)</Label>
                <Input id="itemWeight" name="itemWeight" type="number" step="0.1" placeholder="1.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packageSize">크기 (선택)</Label>
                <Input id="packageSize" name="packageSize" placeholder="가로x세로x높이" />
              </div>
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
          <Button type="submit" disabled={isLoading || !itemType} className="flex-1">
            {isLoading ? "요청 중..." : "기사 연결 요청"}
          </Button>
        </div>
      </form>
    </div>
  )
}
