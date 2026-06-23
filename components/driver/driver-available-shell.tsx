/** 데이터 대기 없이 즉시 표시 */
export function DriverAvailableShell() {
  return (
    <div className="w-full min-w-0 -mx-2 -my-2 px-0 py-1 space-y-2 md:-mx-3 md:-my-4 md:px-0 md:py-2">
      <div className="rounded-xl border border-border/60 bg-card p-4 animate-pulse">
        <div className="h-6 w-28 rounded bg-muted" />
        <div className="h-3 w-40 rounded bg-muted mt-2" />
      </div>
    </div>
  )
}
