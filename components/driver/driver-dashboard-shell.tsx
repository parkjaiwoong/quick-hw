/** 데이터 대기 없이 즉시 표시 — 기사 대시보드 상단 틀 */
export function DriverDashboardShell() {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-balance">배송원 대시보드</h1>
        <p className="text-muted-foreground mt-1">안전 운행하세요</p>
      </div>
    </div>
  )
}
