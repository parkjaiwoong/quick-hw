import { Card } from "@/components/ui/card"
import { NewDeliveryShell } from "@/components/customer/new-delivery-shell"
import { FormFieldsSkeleton } from "@/components/ui/page-skeletons"

export default function NewDeliveryLoading() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <NewDeliveryShell />
          <FormFieldsSkeleton fields={5} />
        </Card>
      </div>
    </div>
  )
}
