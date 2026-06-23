import { Suspense } from "react"
import { unstable_noStore } from "next/cache"
import { CustomerDeliveryDetailShell } from "@/components/customer/customer-delivery-detail-shell"
import { CustomerDeliveryDetailBody } from "@/components/customer/customer-delivery-detail-body"
import { DetailPageSkeleton } from "@/components/ui/page-skeletons"

export const dynamic = "force-dynamic"

export default async function DeliveryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  unstable_noStore()
  const { id } = await params
  const sp = searchParams ? await searchParams : {}

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <CustomerDeliveryDetailShell />
        <Suspense fallback={<DetailPageSkeleton />}>
          <CustomerDeliveryDetailBody id={id} searchParams={sp} />
        </Suspense>
      </div>
    </div>
  )
}
