/** 데이터 대기 없이 즉시 표시 — 관리자 대시보드 상단 틀 */
export function AdminDashboardShell() {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-balance">관리자 / CS 대시보드</h1>
        <p className="text-muted-foreground mt-1">플랫폼 관리 및 CS 응대</p>
      </div>
    </div>
  )
}
