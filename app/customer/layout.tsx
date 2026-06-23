import { CustomerLayoutClient } from "@/components/customer/customer-layout-client"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLayoutClient>{children}</CustomerLayoutClient>
}
