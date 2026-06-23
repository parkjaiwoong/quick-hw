import { Suspense } from "react"
import { DriverAvailableShell } from "@/components/driver/driver-available-shell"
import { DriverAvailableBody } from "@/components/driver/driver-available-body"
import { DriverRouteSkeleton } from "@/components/driver/driver-route-skeleton"

export default function DriverAvailablePage() {
  return (
    <div className="min-h-screen bg-background">
      <DriverAvailableShell />
      <Suspense fallback={<DriverRouteSkeleton />}>
        <DriverAvailableBody />
      </Suspense>
    </div>
  )
}
