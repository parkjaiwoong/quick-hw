import { DriverAvailableShell } from "@/components/driver/driver-available-shell"
import { DriverRouteSkeleton } from "@/components/driver/driver-route-skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <DriverAvailableShell />
      <DriverRouteSkeleton />
    </div>
  )
}
