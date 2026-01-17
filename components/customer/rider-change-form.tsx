"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { requestRiderChangeWithState } from "@/lib/actions/rider-referral"

type RiderChangeState = {
  status: "idle" | "success" | "error"
  changeStatus?: string
  cooldownUntil?: string
  reason?: string
  requestId?: string | null
}

const initialState: RiderChangeState = { status: "idle" }

function buildChangeMessage(state: RiderChangeState) {
  const changeStatus = state.changeStatus
  if (!changeStatus) return null
  if (changeStatus === "pending") return "기사 변경 요청이 접수되었습니다."
  if (changeStatus === "no_current_referral") {
    return "현재 귀속된 기사가 없어 변경 요청을 진행할 수 없습니다."
  }
  if (changeStatus === "cooldown") {
    if (!state.cooldownUntil) return "쿨타임이 적용 중입니다."
    const formatted = new Date(state.cooldownUntil).toLocaleString("ko-KR")
    return `쿨타임이 적용 중입니다. ${formatted}`
  }
  if (changeStatus === "blocked") {
    if (state.reason === "already_requested") {
      return "기사 변경 요청은 1회만 가능합니다."
    }
    return "요청이 차단되었습니다."
  }
  if (changeStatus === "invalid_code") return "입력한 기사 코드를 찾을 수 없습니다."
  if (changeStatus === "same_rider") return "현재 귀속 기사와 동일한 코드입니다."
  if (changeStatus === "error") {
    return `요청 처리 중 오류가 발생했습니다.${state.reason ? ` (${state.reason})` : ""}`
  }
  return null
}

export function RiderChangeForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(requestRiderChangeWithState, initialState)

  useEffect(() => {
    if (state.status === "idle") return
    if (state.status === "success" && state.changeStatus === "pending") {
      if (state.requestId) {
        router.push(`/customer/rider-change-request/${state.requestId}`)
      } else {
        router.push("/customer/rider-change-request")
      }
      return
    }
    const params = new URLSearchParams()
    if (state.changeStatus) params.set("change", state.changeStatus)
    if (state.reason) params.set("reason", state.reason)
    const queryString = params.toString()
    router.replace(queryString ? `/customer?${queryString}` : "/customer")
  }, [router, state])

  const message = buildChangeMessage(state)

  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="rider_code">
          변경할 기사 코드
        </label>
        <input
          id="rider_code"
          name="rider_code"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          placeholder="기사 코드 입력"
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="reason">
          변경 사유 (선택)
        </label>
        <input
          id="reason"
          name="reason"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          placeholder="선택 입력"
        />
      </div>
      {message && (
        <Alert variant={state.status === "error" ? "destructive" : "default"} className="md:col-span-2">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button className="md:col-span-2" type="submit" disabled={isPending}>
        {isPending ? "요청 중..." : "기사 변경 요청"}
      </Button>
    </form>
  )
}
