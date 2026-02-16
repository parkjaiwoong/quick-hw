/**
 * 라우트 전환 시 즉시 표시되는 로딩 UI.
 * loading.tsx에서 사용해 클릭 후 체감 속도를 높입니다.
 */
export function RouteLoading() {
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center p-8" aria-label="불러오는 중">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    </div>
  )
}

/** 헤더/네비 있는 레이아웃용 전체 높이 로딩 */
export function RouteLoadingFull() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center p-8" aria-label="불러오는 중">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </div>
    </div>
  )
}
