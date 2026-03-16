"use server"

import { approvePayout, holdPayout, rejectPayout, transferPayout } from "@/lib/actions/finance"

export async function approvePayoutAction(payoutId: string) {
  if (!payoutId) return { error: "출금 요청 ID가 없습니다." }
  return approvePayout(payoutId)
}

export async function transferPayoutAction(payoutId: string) {
  if (!payoutId) return { error: "출금 요청 ID가 없습니다." }
  return transferPayout(payoutId, "MANUAL")
}

export async function holdPayoutAction(payoutId: string, reason: string) {
  if (!payoutId) return { error: "출금 요청 ID가 없습니다." }
  return holdPayout(payoutId, reason)
}

export async function rejectPayoutAction(payoutId: string, reason: string) {
  if (!payoutId) return { error: "출금 요청 ID가 없습니다." }
  return rejectPayout(payoutId, reason)
}
