"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Shield, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { reportAccident, uploadAccidentPhotos } from "@/lib/actions/accident"
import Link from "next/link"
import { toAddressFromDongOrRoad } from "@/lib/address-abbrev"
import { AccidentPhotos } from "@/components/accident/accident-photos"

interface DriverAccidentReportClientProps {
  deliveries: { id: string; pickup_address?: string; delivery_address?: string; status: string; created_at: string }[]
  accidents: {
    id: string
    accident_type: string
    accident_description: string
    created_at: string
    status: string
    photos?: string[] | string | null
    delivery?: { pickup_address?: string; delivery_address?: string } | null
  }[]
  prefilledDeliveryId: string | null
}

export function DriverAccidentReportClient({
  deliveries,
  accidents,
  prefilledDeliveryId,
}: DriverAccidentReportClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(prefilledDeliveryId ?? "")
  const [accidentType, setAccidentType] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [accidentsList, setAccidentsList] = useState(accidents)
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    if (prefilledDeliveryId) setSelectedDeliveryId(prefilledDeliveryId)
  }, [prefilledDeliveryId])
  useEffect(() => {
    setAccidentsList(accidents)
  }, [accidents])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    let photoUrls: string[] = []
    if (photos.length > 0) {
      const fd = new FormData()
      photos.slice(0, 5).forEach((f) => fd.append("photos", f))
      const uploadRes = await uploadAccidentPhotos(fd)
      if (uploadRes.error) {
        setError(uploadRes.error)
        setIsLoading(false)
        return
      }
      photoUrls = uploadRes.urls ?? []
    }

    const result = await reportAccident({
      deliveryId: selectedDeliveryId || undefined,
      accidentType: accidentType,
      accidentDate: new Date().toISOString(),
      accidentDescription: formData.get("description") as string,
      packageDamageDescription: accidentType === "damage" ? (formData.get("damageDescription") as string) : undefined,
      photos: photoUrls.length > 0 ? photoUrls : undefined,
    })

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setIsSubmitted(true)
      router.refresh()
    }
    setIsLoading(false)
  }

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>사고 신고 완료</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                사고 신고가 접수되었습니다. 현장 사진을 반드시 남겨두시고, 접수 후 1영업일 내에 안내드리겠습니다.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3">
              <Button onClick={() => { setIsSubmitted(false); setAccidentType(""); setSelectedDeliveryId(""); setPhotos([]); setFileInputKey((k) => k + 1) }} variant="outline" className="flex-1">
                추가 신고
              </Button>
              <Button asChild className="flex-1">
                <Link href="/driver">대시보드로</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        {accidentsList.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>내 사고 신고 내역</CardTitle>
              <CardDescription>신고한 사고 내용을 확인할 수 있습니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {accidentsList.slice(0, 5).map((accident) => (
                <div key={accident.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {accident.accident_type === "damage" ? "물품 파손" : "물품 분실"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(accident.created_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {accident.delivery && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {toAddressFromDongOrRoad(accident.delivery.pickup_address)} →{" "}
                      {toAddressFromDongOrRoad(accident.delivery.delivery_address)}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-2">{accident.accident_description}</p>
                  <AccidentPhotos photos={accident.photos} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">사고 신고</h1>
        <p className="text-muted-foreground text-sm">
          배송 중 물품 파손·분실이 발생하면 즉시 신고해 주세요. 사진 증빙을 남겨두시면 보험 처리에 도움이 됩니다.
        </p>
      </div>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>안내:</strong> 사고 발생 시 현장에서 즉시 사진을 촬영해 업로드해 주세요. 물품 사고는 플랫폼 보험으로 처리됩니다.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>사고 정보</CardTitle>
          <CardDescription>
            사고가 발생한 배송과 사고 유형을 선택하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryId">배송 선택 *</Label>
              <Select
                value={selectedDeliveryId || "none"}
                onValueChange={(value) => setSelectedDeliveryId(value === "none" ? "" : value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="배송을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택하세요</SelectItem>
                  {deliveries.map((delivery) => (
                    <SelectItem key={delivery.id} value={delivery.id}>
                      {toAddressFromDongOrRoad(delivery.pickup_address)} → {toAddressFromDongOrRoad(delivery.delivery_address)}
                      {delivery.status !== "delivered" && ` (${delivery.status === "accepted" ? "수락됨" : delivery.status === "picked_up" ? "픽업완료" : "배송중"})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accidentType">사고 유형 *</Label>
              <Select value={accidentType} onValueChange={setAccidentType} required>
                <SelectTrigger>
                  <SelectValue placeholder="사고 유형을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">물품 파손</SelectItem>
                  <SelectItem value="loss">물품 분실</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accidentType === "damage" && (
              <div className="space-y-2">
                <Label htmlFor="damageDescription">파손 상세 설명 *</Label>
                <Textarea
                  id="damageDescription"
                  name="damageDescription"
                  placeholder="파손된 부분과 정도를 자세히 설명해 주세요"
                  rows={4}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">사고 설명 *</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="사고 발생 경위를 자세히 설명해 주세요"
                rows={6}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photos">사진 업로드 (선택, 최대 5장)</Label>
              <div className="flex flex-col gap-2">
                <Input
                  key={fileInputKey}
                  id="photos"
                  name="photos"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={(e) => {
                    if (e.target.files) setPhotos(Array.from(e.target.files).slice(0, 5))
                  }}
                />
                {photos.length > 0 ? (
                  <p className="text-sm text-green-600 font-medium">
                    선택됨: {photos.length}개 파일
                    {photos.length <= 2
                      ? ` (${photos.map((f) => f.name).join(", ")})`
                      : ` (${photos[0].name} 외 ${photos.length - 1}개)`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    현장 증빙 사진을 반드시 촬영해 업로드해 주세요
                  </p>
                )}
              </div>
            </div>

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
              <Button type="submit" disabled={isLoading || !accidentType || !selectedDeliveryId} className="flex-1">
                {isLoading ? "접수 중..." : "사고 신고"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {accidentsList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>내 사고 신고 내역</CardTitle>
            <CardDescription>신고한 사고 내용을 확인할 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accidentsList.map((accident) => (
              <div key={accident.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {accident.accident_type === "damage" ? "물품 파손" : "물품 분실"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(accident.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                {accident.delivery && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {toAddressFromDongOrRoad(accident.delivery.pickup_address)} →{" "}
                    {toAddressFromDongOrRoad(accident.delivery.delivery_address)}
                  </p>
                )}
                <p className="text-muted-foreground mt-2">{accident.accident_description}</p>
                <AccidentPhotos photos={accident.photos} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
