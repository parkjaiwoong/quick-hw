import { Suspense } from "react"
import { DriverDeliveryDetailBody } from "@/components/driver/driver-delivery-detail-body"
import { DetailPageSkeleton } from "@/components/ui/page-skeletons"

export default async function DriverDeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ accept_delivery?: string }>
}) {
  const { id } = await params
  const sp = await (searchParams ?? Promise.resolve(undefined))
  const acceptDeliveryId = id && sp?.accept_delivery === id ? id : null

  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <DriverDeliveryDetailBody id={id} acceptDeliveryId={acceptDeliveryId} />
    </Suspense>
  )
}
