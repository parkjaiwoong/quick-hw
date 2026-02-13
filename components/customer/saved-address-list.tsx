"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MapPin, Trash2 } from "lucide-react"
import { getSavedAddresses, deleteSavedAddress, type SavedAddress, type SavedAddressType } from "@/lib/actions/saved-addresses"

export function SavedAddressList() {
  const [pickupList, setPickupList] = useState<SavedAddress[]>([])
  const [deliveryList, setDeliveryList] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [pickupRes, deliveryRes] = await Promise.all([
      getSavedAddresses("pickup"),
      getSavedAddresses("delivery"),
    ])
    setPickupList(pickupRes.data ?? [])
    setDeliveryList(deliveryRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteSavedAddress(id)
    setDeletingId(null)
    if (!res.error) {
      await load()
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          목록 불러오는 중…
        </CardContent>
      </Card>
    )
  }

  const empty = pickupList.length === 0 && deliveryList.length === 0
  if (empty) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MapPin className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>등록된 주소가 없습니다.</p>
          <p className="text-sm mt-1">아래 버튼으로 출발지·도착지를 추가하세요.</p>
        </CardContent>
      </Card>
    )
  }

  function Section({ type, list }: { type: SavedAddressType; list: SavedAddress[] }) {
    const title = type === "pickup" ? "출발지" : "도착지"
    if (list.length === 0) return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {list.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-lg border p-3 bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.address}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Section type="pickup" list={pickupList} />
      <Section type="delivery" list={deliveryList} />
    </div>
  )
}
