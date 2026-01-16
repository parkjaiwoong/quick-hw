"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Truck, Shield, Phone, CheckCircle } from "lucide-react"
import { requestDriverConnection } from "@/lib/actions/deliveries"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Driver {
  id: string
  full_name: string
  vehicle_type: string
  rating: number
  total_deliveries: number
  is_available: boolean
  distance_km: number
  has_insurance: boolean
}

interface DriverRecommendationListProps {
  drivers: Driver[]
  deliveryId: string
}

export function DriverRecommendationList({ drivers, deliveryId }: DriverRecommendationListProps) {
  const router = useRouter()
  const [loadingDriverId, setLoadingDriverId] = useState<string | null>(null)
  const [connectedDriverId, setConnectedDriverId] = useState<string | null>(null)

  async function handleConnectRequest(driverId: string) {
    setLoadingDriverId(driverId)
    
    const result = await requestDriverConnection(deliveryId, driverId)
    
    if (result.error) {
      alert(result.error)
      setLoadingDriverId(null)
    } else {
      setConnectedDriverId(driverId)
      // 2초 후 고객 대시보드로 이동
      setTimeout(() => {
        router.push("/customer")
      }, 2000)
    }
  }

  return (
    <div className="space-y-4">
      {drivers.map((driver) => (
        <Card key={driver.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {driver.full_name || "기사"}
                  {driver.has_insurance && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Shield className="h-3 w-3 mr-1" />
                      보험 가입
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  거리: {driver.distance_km?.toFixed(1) || "0"}km
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">평점</div>
                <div className="text-lg font-bold">{driver.rating?.toFixed(1) || "5.0"}</div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.vehicle_type || "일반"}</span>
                </div>
                <div className="text-muted-foreground">
                  운행 {driver.total_deliveries || 0}건
                </div>
              </div>

              {connectedDriverId === driver.id ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    연결 요청이 전송되었습니다! 기사가 수락하면 연락처가 공개됩니다.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={() => handleConnectRequest(driver.id)}
                  disabled={loadingDriverId !== null || !driver.is_available}
                  className="w-full"
                >
                  {loadingDriverId === driver.id ? (
                    "요청 중..."
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      연결 요청
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

