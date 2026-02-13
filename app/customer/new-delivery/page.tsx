import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeliveryRequestForm } from "@/components/customer/delivery-request-form"

function parsePointLocation(pl: unknown): { lat: string; lng: string } | null {
  if (!pl) return null
  if (typeof pl === "string") {
    const m = pl.match(/\(([^,]+),([^)]+)\)/)
    if (m) {
      const a = Number.parseFloat(m[1])
      const b = Number.parseFloat(m[2])
      if (Number.isFinite(a) && Number.isFinite(b)) return { lng: m[1], lat: m[2] }
    }
    return null
  }
  const o = pl as { coordinates?: [number, number]; x?: number; y?: number }
  if (Array.isArray(o.coordinates) && o.coordinates.length >= 2)
    return { lng: String(o.coordinates[0]), lat: String(o.coordinates[1]) }
  if (Number.isFinite(o.x) && Number.isFinite(o.y)) return { lng: String(o.x), lat: String(o.y) }
  return null
}

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await getSupabaseServerClient()
  const params = await searchParams

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
  const { data: pricing } = await supabase
    .from("pricing_config")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : (v as string | undefined)
  }

  // URL에서 넘어온 주소가 없으면, 한 번이라도 요청한 적 있으면 최신 배송의 출발지/도착지·연락처·메모로 자동 셋팅
  const hasUrlPickup = !!get("pickupAddress") || !!get("pickupLat") || !!get("pickupLng")
  const hasUrlDelivery = !!get("deliveryAddress") || !!get("deliveryLat") || !!get("deliveryLng")

  let lastDelivery: {
    pickup_address: string
    pickup_location: unknown
    pickup_contact_name: string
    pickup_contact_phone: string
    pickup_notes: string | null
    delivery_address: string
    delivery_location: unknown
    delivery_contact_name: string
    delivery_contact_phone: string
    delivery_notes: string | null
  } | null = null

  if (!hasUrlPickup || !hasUrlDelivery) {
    const { data: last } = await supabase
      .from("deliveries")
      .select(
        "pickup_address, pickup_location, pickup_contact_name, pickup_contact_phone, pickup_notes, delivery_address, delivery_location, delivery_contact_name, delivery_contact_phone, delivery_notes",
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    lastDelivery = last ?? null
  }

  const pickupPoint = lastDelivery?.pickup_location ? parsePointLocation(lastDelivery.pickup_location) : null
  const deliveryPoint = lastDelivery?.delivery_location ? parsePointLocation(lastDelivery.delivery_location) : null

  const initialPickupAddress = get("pickupAddress") ?? (!hasUrlPickup ? lastDelivery?.pickup_address : undefined)
  const initialPickupLat = get("pickupLat") ?? (!hasUrlPickup ? pickupPoint?.lat : undefined)
  const initialPickupLng = get("pickupLng") ?? (!hasUrlPickup ? pickupPoint?.lng : undefined)
  const initialDeliveryAddress = get("deliveryAddress") ?? (!hasUrlDelivery ? lastDelivery?.delivery_address : undefined)
  const initialDeliveryLat = get("deliveryLat") ?? (!hasUrlDelivery ? deliveryPoint?.lat : undefined)
  const initialDeliveryLng = get("deliveryLng") ?? (!hasUrlDelivery ? deliveryPoint?.lng : undefined)

  const initialPickupContactName = get("pickupContactName") ?? lastDelivery?.pickup_contact_name
  const initialPickupContactPhone = get("pickupContactPhone") ?? lastDelivery?.pickup_contact_phone
  const initialPickupNotes = get("pickupNotes") ?? lastDelivery?.pickup_notes ?? undefined
  const initialDeliveryContactName = get("deliveryContactName") ?? lastDelivery?.delivery_contact_name
  const initialDeliveryContactPhone = get("deliveryContactPhone") ?? lastDelivery?.delivery_contact_phone
  const initialDeliveryNotes = get("deliveryNotes") ?? lastDelivery?.delivery_notes ?? undefined

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>새 배송 요청</CardTitle>
            <CardDescription>픽업 및 배송 정보를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <DeliveryRequestForm
              userProfile={profile}
              pricingConfig={pricing}
              initialPickupAddress={initialPickupAddress}
              initialPickupLat={initialPickupLat}
              initialPickupLng={initialPickupLng}
              initialDeliveryAddress={initialDeliveryAddress}
              initialDeliveryLat={initialDeliveryLat}
              initialDeliveryLng={initialDeliveryLng}
              initialPickupContactName={initialPickupContactName}
              initialPickupContactPhone={initialPickupContactPhone}
              initialPickupNotes={initialPickupNotes}
              initialDeliveryContactName={initialDeliveryContactName}
              initialDeliveryContactPhone={initialDeliveryContactPhone}
              initialDeliveryNotes={initialDeliveryNotes}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
