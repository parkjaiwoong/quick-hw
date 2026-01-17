import { handleRiderUrlAccess, confirmReferralFromCookie, requestRiderChange, resolveRiderForOrder } from "@/lib/actions/server-actions"

// 1) /r/{code} 진입 처리
export async function onRiderEntry(code: string) {
  const result = await handleRiderUrlAccess(code)
  if (result.status === "assigned") {
    return "/customer"
  }
  if (result.status === "cookie_only") {
    return "/auth/signup"
  }
  return "/"
}

// 2) 회원가입/로그인 완료 후 귀속 확정
export async function onAuthComplete() {
  await confirmReferralFromCookie()
}

// 3) 고객 기사 변경 요청
export async function onRiderChangeRequest(formData: FormData) {
  return requestRiderChange(formData)
}

// 4) 주문 생성 시 기사 결정
export async function onCreateOrder(customerId: string) {
  const { riderId } = await resolveRiderForOrder(customerId)
  return riderId
}
