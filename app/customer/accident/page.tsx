"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle, Shield, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { reportAccident } from "@/lib/actions/accident"
import { createClient } from "@/lib/supabase/client"

export default function AccidentReportPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("")
  const [accidentType, setAccidentType] = useState("")
  const [photos, setPhotos] = useState<File[]>([])

  useEffect(() => {
    // 고객의 배송 목록 가져오기
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from("deliveries")
          .select("id, pickup_address, delivery_address, created_at")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false })
          .then(({ data }) => {
            setDeliveries(data || [])
          })
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    
    const result = await reportAccident({
      deliveryId: selectedDeliveryId || undefined,
      accidentType: accidentType,
      accidentDate: new Date().toISOString(),
      accidentDescription: formData.get("description") as string,
      packageDamageDescription: accidentType === "damage" ? formData.get("damageDescription") as string : undefined,
    })

    if (result.error) {
      setError(result.error)
      setIsLoading(false)
    } else {
      setIsSubmitted(true)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>사고 접수 완료</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  사고 접수가 완료되었습니다. 접수 후 1영업일 내에 안내드리겠습니다.
                </AlertDescription>
              </Alert>
              <Button onClick={() => router.push("/customer")} className="w-full">
                대시보드로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">물품 사고 접수</h1>
          <p className="text-muted-foreground">
            물품 파손 또는 분실 사고를 접수해주세요
          </p>
        </div>

        <Alert className="border-orange-200 bg-orange-50">
          <Shield className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            <strong>보험 안내:</strong> 물품 사고는 플랫폼 보험으로 처리됩니다. 
            보상 한도는 약관에 명시되어 있습니다. <a href="/terms" className="underline">약관 보기</a>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>사고 정보</CardTitle>
            <CardDescription>
              사고가 발생한 배송과 사고 유형을 선택해주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryId">배송 선택 (선택)</Label>
                <Select value={selectedDeliveryId} onValueChange={setSelectedDeliveryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="배송을 선택하세요 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">선택 안 함</SelectItem>
                    {deliveries.map((delivery) => (
                      <SelectItem key={delivery.id} value={delivery.id}>
                        {delivery.pickup_address} → {delivery.delivery_address}
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
                    placeholder="파손된 부분과 정도를 자세히 설명해주세요"
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
                  placeholder="사고 발생 경위를 자세히 설명해주세요"
                  rows={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photos">사진 업로드 (선택)</Label>
                <Input
                  id="photos"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      setPhotos(Array.from(e.target.files))
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  사고 증빙을 위한 사진을 업로드해주세요 (최대 5장)
                </p>
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
                <Button type="submit" disabled={isLoading || !accidentType} className="flex-1">
                  {isLoading ? "접수 중..." : "사고 접수"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
