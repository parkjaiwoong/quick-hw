"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { dispatchDriver } from "@/lib/actions/dispatch"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface DispatchDialogProps {
  delivery: any
  drivers: any[]
}

export function DispatchDialog({ delivery, drivers }: DispatchDialogProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDispatch = async () => {
    if (!selectedDriverId) {
      toast.error("배송원을 선택해주세요")
      return
    }

    setLoading(true)
    const result = await dispatchDriver(delivery.id, selectedDriverId)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("배송원 배차가 완료되었습니다")
      setOpen(false)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">배차하기</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>배송원 배차</DialogTitle>
          <DialogDescription>이 배송에 배송원을 배차하세요</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm font-medium mb-2">배송 정보</p>
            <p className="text-sm text-muted-foreground">
              {delivery.pickup_address} → {delivery.delivery_address}
            </p>
            <p className="text-sm text-muted-foreground">
              거리: {delivery.distance_km?.toFixed(1)}km | 요금: {delivery.total_fee?.toLocaleString()}원
            </p>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">배송원 선택</p>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="배송원을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.full_name || driver.email} - {driver.driver_info?.vehicle_type} (
                    {driver.driver_info?.vehicle_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleDispatch} disabled={loading || !selectedDriverId}>
            {loading ? "배차 중..." : "배차하기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

