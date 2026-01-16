"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getRoleOverride } from "@/lib/role"
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

// 포인트 교환 요청 (상품권 등)
export async function requestPointRedemption(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsCustomer =
    roleOverride === "customer" || roleOverride === "admin" || profile?.role === "customer" || profile?.role === "admin"
  if (!canActAsCustomer) {
    throw new Error("권한이 없습니다")
  }

  const rawPoints = String(formData.get("points") || "").trim()
  const contact = String(formData.get("contact") || "").trim()
  const note = String(formData.get("note") || "").trim()
  const attachment = formData.get("attachment")

  const points = Number(rawPoints)
  if (!Number.isFinite(points) || points <= 0) {
    throw new Error("요청 포인트를 확인해주세요")
  }

  const { data: balanceData } = await supabase
    .from("points")
    .select("points, point_type")
    .eq("user_id", user.id)

  const balance =
    balanceData?.reduce((sum, p) => {
      if (p.point_type === "earned") return sum + Number(p.points)
      if (p.point_type === "used" || p.point_type === "expired") return sum - Number(p.points)
      return sum
    }, 0) || 0

  if (balance < points) {
    throw new Error("포인트가 부족합니다")
  }

  let attachmentUrl: string | null = null
  if (attachment instanceof File && attachment.size > 0) {
    const bucketName = "point-redemptions"
    const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `${user.id}/${Date.now()}_${safeName}`
    const buffer = Buffer.from(await attachment.arrayBuffer())
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, { contentType: attachment.type || "application/octet-stream" })

    if (uploadError) {
      throw new Error(`첨부 업로드에 실패했습니다: ${uploadError.message}`)
    }

    const { data: publicUrl } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    attachmentUrl = publicUrl.publicUrl
  }

  const message = [
    `요청 포인트: ${points}P`,
    `연락처: ${contact || "-"}`,
    `요청 내용: ${note || "-"}`,
    attachmentUrl ? `첨부: ${attachmentUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const { error } = await supabase.from("notifications").insert({
    user_id: user.id,
    title: "포인트 교환 요청",
    message,
    type: "point_redemption",
    is_read: false,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath("/customer/points")
  revalidatePath("/admin/inquiries")
}

// 관리자: 포인트 교환 요청 처리
export async function processPointRedemption(formData: FormData): Promise<void> {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("인증이 필요합니다")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  const roleOverride = await getRoleOverride()
  const canActAsAdmin = roleOverride === "admin" || profile?.role === "admin"
  if (!canActAsAdmin) {
    throw new Error("권한이 없습니다")
  }

  const id = String(formData.get("id") || "").trim()
  const rawPoints = String(formData.get("points") || "").trim()

  const points = Number(rawPoints)
  if (!id || !Number.isFinite(points) || points <= 0) {
    throw new Error("요청 정보를 확인해주세요")
  }

  const { data: request, error: requestError } = await supabase
    .from("notifications")
    .select("id, user_id, type, is_read, message")
    .eq("id", id)
    .single()

  if (requestError || !request) {
    throw new Error("요청 정보를 찾을 수 없습니다")
  }

  if (request.type !== "point_redemption") {
    throw new Error("포인트 교환 요청이 아닙니다")
  }

  if (request.is_read) {
    return
  }

  const { data: balanceData } = await supabase
    .from("points")
    .select("points, point_type")
    .eq("user_id", request.user_id)

  const balance =
    balanceData?.reduce((sum, p) => {
      if (p.point_type === "earned") return sum + Number(p.points)
      if (p.point_type === "used" || p.point_type === "expired") return sum - Number(p.points)
      return sum
    }, 0) || 0

  if (balance < points) {
    throw new Error("포인트가 부족합니다")
  }

  const { error: useError } = await supabase.from("points").insert({
    user_id: request.user_id,
    points,
    point_type: "used",
    description: "포인트 교환 처리",
  })

  if (useError) {
    throw new Error(useError.message)
  }

  const processor = profile?.full_name || profile?.email || user.id
  const processedAt = new Date().toLocaleString("ko-KR")
  const nextMessage = [request.message, "", `처리자: ${processor}`, `처리일시: ${processedAt}`]
    .filter(Boolean)
    .join("\n")

  const { error: updateError } = await supabase
    .from("notifications")
    .update({ is_read: true, message: nextMessage })
    .eq("id", id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  const contact = request.message?.match(/연락처:\s*(.+)/)?.[1]?.trim()
  const note = request.message?.match(/요청 내용:\s*(.+)/)?.[1]?.trim()
  const attachment = request.message?.match(/첨부:\s*(.+)/)?.[1]?.trim()
  const requestIdShort = request.id.slice(0, 8)
  const remainingBalance = balance - points
  const completionMessage = [
    `포인트 ${points.toLocaleString()}P 교환이 완료되었습니다.`,
    `요청 번호: ${requestIdShort}`,
    `처리 일시: ${processedAt}`,
    `처리자: ${processor}`,
    `처리 후 잔액: ${remainingBalance.toLocaleString()}P`,
    contact ? `연락처: ${contact}` : null,
    note ? `요청 내용: ${note}` : null,
    attachment ? `첨부 확인: ${attachment}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const { error: notifyError } = await supabase.from("notifications").insert({
    user_id: request.user_id,
    title: "포인트 교환 완료",
    message: completionMessage,
    type: "point_redemption_completed",
    is_read: false,
  })

  if (notifyError) {
    throw new Error(notifyError.message)
  }

  revalidatePath("/admin/inquiries")
  revalidatePath("/customer/points")
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

