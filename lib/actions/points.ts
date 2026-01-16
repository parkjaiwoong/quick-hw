"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// 포인트 적립
export async function earnPoints(userId: string, points: number, sourceType: string, sourceId?: string, description?: string) {
  const supabase = await getSupabaseServerClient()

  const { error } = await supabase.from("points").insert({
    user_id: userId,
    points,
    point_type: "earned",
    source_type: sourceType,
    source_id: sourceId,
    description: description || `${points}포인트 적립`,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/customer/points")
  return { success: true }
}

// 포인트 사용
export async function usePoints(userId: string, points: number, description?: string) {
  const supabase = await getSupabaseServerClient()

  // 현재 포인트 잔액 확인
  const { data: balanceData } = await supabase
    .from("points")
    .select("points, point_type")
    .eq("user_id", userId)

  const balance =
    balanceData?.reduce((sum, p) => {
      if (p.point_type === "earned") return sum + Number(p.points)
      if (p.point_type === "used" || p.point_type === "expired") return sum - Number(p.points)
      return sum
    }, 0) || 0

  if (balance < points) {
    return { error: "포인트가 부족합니다" }
  }

  const { error } = await supabase.from("points").insert({
    user_id: userId,
    points,
    point_type: "used",
    description: description || `${points}포인트 사용`,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/customer/points")
  return { success: true }
}

// 포인트 잔액 조회
export async function getPointBalance(userId: string) {
  const supabase = await getSupabaseServerClient()

  const { data } = await supabase
    .from("points")
    .select("points, point_type")
    .eq("user_id", userId)

  const balance =
    data?.reduce((sum, p) => {
      if (p.point_type === "earned") return sum + Number(p.points)
      if (p.point_type === "used" || p.point_type === "expired") return sum - Number(p.points)
      return sum
    }, 0) || 0

  return { balance }
}

// 포인트 내역 조회
export async function getPointHistory(userId: string) {
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from("points")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return { error: error.message }
  }

  return { history: data }
}

// 추천인 등록
export async function registerReferral(referralCode: string) {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "인증이 필요합니다" }
  }

  // 추천인 코드로 사용자 찾기
  const { data: referrer } = await supabase
    .from("profiles")
    .select("id")
    .eq("referral_code", referralCode)
    .single()

  if (!referrer) {
    return { error: "유효하지 않은 추천인 코드입니다" }
  }

  if (referrer.id === user.id) {
    return { error: "자기 자신을 추천할 수 없습니다" }
  }

  // 이미 등록된 추천인인지 확인
  const { data: existing } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_id", user.id)
    .single()

  if (existing) {
    return { error: "이미 추천인이 등록되어 있습니다" }
  }

  const { data: referral, error } = await supabase
    .from("referrals")
    .insert({
      referrer_id: referrer.id,
      referred_id: user.id,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/customer/referral")
  return { success: true, referral }
}

// 추천인 보상 지급 (첫 배송 완료 시)
export async function processReferralReward(userId: string, deliveryId: string) {
  const supabase = await getSupabaseServerClient()

  // 추천인 관계 확인
  const { data: referral } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_id", userId)
    .eq("status", "pending")
    .single()

  if (!referral) {
    return { success: false, message: "추천인 관계가 없습니다" }
  }

  // 추천인 보상 (500포인트)
  await earnPoints(referral.referrer_id, 500, "referral", referral.id, "추천인 보상")
  // 추천받은 사람 보상 (300포인트)
  await earnPoints(userId, 300, "referral", referral.id, "추천 보상")

  // 추천인 관계 완료 처리
  await supabase
    .from("referrals")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      referrer_reward_points: 500,
      referred_reward_points: 300,
    })
    .eq("id", referral.id)

  revalidatePath("/customer/referral")
  return { success: true }
}

