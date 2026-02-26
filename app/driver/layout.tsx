import { DriverScreenNotifier } from "@/components/driver/driver-screen-notifier"

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DriverScreenNotifier />
      {children}
    </>
  )
}
