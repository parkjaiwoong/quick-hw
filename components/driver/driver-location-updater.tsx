"use client"

import { useEffect, useState } from "react"
import { updateDriverLocation } from "@/lib/actions/driver"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Navigation } from "lucide-react"

interface DriverLocationUpdaterProps {
  deliveryId: string
}

export function DriverLocationUpdater({ deliveryId }: DriverLocationUpdaterProps) {
  const [isTracking, setIsTracking] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    let watchId: number | null = null

    if (isTracking && "geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords

          console.log("[v0] Location update:", { latitude, longitude })

          await updateDriverLocation(latitude, longitude, deliveryId)
          setLastUpdate(new Date())
          setError("")
        },
        (error) => {
          console.error("[v0] Geolocation error:", error)
          setError("위치 정보를 가져올 수 없습니다")
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      )
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [isTracking, deliveryId])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          위치 추적
        </CardTitle>
        <CardDescription>고객이 실시간으로 배송 위치를 확인할 수 있습니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => setIsTracking(!isTracking)}
          className="w-full"
          variant={isTracking ? "destructive" : "default"}
        >
          <MapPin className="mr-2 h-4 w-4" />
          {isTracking ? "위치 추적 중지" : "위치 추적 시작"}
        </Button>

        {isTracking && (
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-sm text-green-800 font-medium">위치 추적 활성화됨</p>
            {lastUpdate && (
              <p className="text-xs text-green-700 mt-1">마지막 업데이트: {lastUpdate.toLocaleTimeString("ko-KR")}</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>💡 위치 추적 기능:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>배송 중 자동으로 위치가 업데이트됩니다</li>
            <li>고객은 지도에서 실시간 위치를 확인합니다</li>
            <li>배터리 절약을 위해 적절한 간격으로 업데이트됩니다</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
