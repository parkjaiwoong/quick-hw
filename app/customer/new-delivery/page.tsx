import { getSupabaseServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeliveryRequestForm } from "@/components/customer/delivery-request-form"
import { getNewDeliveryPageData } from "@/lib/actions/deliveries"

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

  // 한 번의 RPC로 profile + pricing + last_delivery 조회 (DB 튜닝). 실패 시 기존 쿼리로 폴백
  let profile: Record<string, unknown> | null = null
  let pricing: Record<string, unknown> | null = null
  let lastDelivery: {
    pickup_address?: string
    pickup_location?: unknown
    pickup_contact_name?: string
    pickup_contact_phone?: string
    pickup_notes?: string | null
    delivery_address?: string
    delivery_location?: unknown
    delivery_contact_name?: string
    delivery_contact_phone?: string
    delivery_notes?: string | null
  } | null = null

  const pageData = await getNewDeliveryPageData(user.id)
  if (!pageData.error) {
    profile = pageData.profile
    pricing = pageData.pricing
    lastDelivery = pageData.lastDelivery as typeof lastDelivery
  } else {
    const [{ data: profileRow }, { data: pricingRow }, { data: lastRow }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("pricing_config").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("deliveries")
        .select("pickup_address, pickup_location, pickup_contact_name, pickup_contact_phone, pickup_notes, delivery_address, delivery_location, delivery_contact_name, delivery_contact_phone, delivery_notes")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    profile = profileRow ?? null
    pricing = pricingRow ?? null
    lastDelivery = lastRow ?? null
  }

  const get = (key: string) => {
    const v = params[key]
    return Array.isArray(v) ? v[0] : (v as string | undefined)
  }

  const hasUrlPickup = !!get("pickupAddress") || !!get("pickupLat") || !!get("pickupLng")
  const hasUrlDelivery = !!get("deliveryAddress") || !!get("deliveryLat") || !!get("deliveryLng")

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
    <div className="min-h-screen bg-background p-4">
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
