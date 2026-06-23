import { Suspense } from "react"
import { Card } from "@/components/ui/card"
import { NewDeliveryShell } from "@/components/customer/new-delivery-shell"
import { NewDeliveryBody } from "@/components/customer/new-delivery-body"
import { FormFieldsSkeleton } from "@/components/ui/page-skeletons"

export default async function NewDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <NewDeliveryShell />
          <Suspense fallback={<FormFieldsSkeleton fields={5} />}>
            <NewDeliveryBody searchParams={params} />
          </Suspense>
        </Card>
      </div>
    </div>
  )
}
