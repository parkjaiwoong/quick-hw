"use client"

import { useState, startTransition } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateDriverAvailability, updateDriverLocation } from "@/lib/actions/driver"
import { useRouter } from "next/navigation"

interface DriverStatusToggleProps {
  initialStatus: boolean
}

export function DriverStatusToggle({ initialStatus }: DriverStatusToggleProps) {
  const router = useRouter()
  const [isAvailable, setIsAvailable] = useState(initialStatus)
  const [isLoading, setIsLoading] = useState(false)

  async function handleToggle(checked: boolean) {
    setIsLoading(true)
    const result = await updateDriverAvailability(checked)
    if (result.error) {
      setIsLoading(false)
      alert(result.error)
      return
    }
    setIsAvailable(checked)
    setIsLoading(false)
    const doRefresh = () => startTransition(() => router.refresh())
    if (checked && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await updateDriverLocation(pos.coords.latitude, pos.coords.longitude)
          doRefresh()
        },
        () => doRefresh(),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      )
    } else {
      doRefresh()
    }
  }

  return (
    <div className="flex items-center gap-3 bg-card p-4 rounded-lg border">
      <Switch id="availability" checked={isAvailable} onCheckedChange={handleToggle} disabled={isLoading} />
      <Label htmlFor="availability" className="cursor-pointer">
        <span className="font-semibold">{isAvailable ? "배송 가능" : "배송 불가"}</span>
        <span className="block text-xs text-muted-foreground">
          {isAvailable ? "새 배송을 받을 수 있습니다" : "새 배송을 받지 않습니다"}
        </span>
      </Label>
    </div>
  )
}
