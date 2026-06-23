import { DriverLayoutClient } from "@/components/driver/driver-layout-client"

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <DriverLayoutClient>{children}</DriverLayoutClient>
}
