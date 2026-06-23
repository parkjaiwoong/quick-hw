import { CustomerDeliveryDetailShell } from "@/components/customer/customer-delivery-detail-shell"
import { DetailPageSkeleton } from "@/components/ui/page-skeletons"

export default function DeliveryDetailLoading() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <CustomerDeliveryDetailShell />
        <DetailPageSkeleton />
      </div>
    </div>
  )
}
