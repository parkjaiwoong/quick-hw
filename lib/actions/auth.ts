"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { confirmReferralFromCookie } from "@/lib/actions/rider-referral"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

function getServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createSupabaseClient(process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}

export async function signUp(formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const phone = formData.get("phone") as string
  const role = (formData.get("role") as string) || "customer"
  // 고객-기사 연결은 딥링크/QR(기사 코드)로만 가능. 폼 입력 제거.
  const referringDriverId = null

  // 입력값 검증
  if (!email || !password || !fullName || !phone) {
    return { error: "모든 필드를 입력해주세요." }
  }

  // emailRedirectTo 설정 - 로컬과 프로덕션 환경 구분
  let redirectUrl = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  
  if (!redirectUrl) {
    // 프로덕션 환경에서는 Vercel URL 사용
    if (process.env.VERCEL_URL) {
      redirectUrl = `https://${process.env.VERCEL_URL}/auth/verify-email`
    } else {
      // 로컬 개발 환경
      redirectUrl = 'http://localhost:3000/auth/verify-email'
    }
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: fullName,
        phone,
        role,
        referring_driver_id: referringDriverId,
      },
    },
  })

  if (authError) {
    console.error("Signup auth error:", authError)
    // 에러 메시지 한글화
    let errorMessage = authError.message
    if (authError.message.includes("User already registered") || 
        authError.message.includes("already registered")) {
      errorMessage = "이미 등록된 이메일입니다. 로그인해주세요."
    } else if (authError.message.includes("Password")) {
      errorMessage = "비밀번호는 최소 6자 이상이어야 합니다."
    } else if (authError.message.includes("Invalid email")) {
      errorMessage = "올바른 이메일 주소를 입력해주세요."
    }
    return { error: errorMessage }
  }

  if (!authData.user) {
    return { error: "회원가입에 실패했습니다. 다시 시도해주세요." }
  }

  const userId = authData.user.id
  
  if (!userId) {
    console.error("User ID가 없습니다:", authData)
    return { error: "사용자 ID를 가져올 수 없습니다. 다시 시도해주세요." }
  }

  // 프로필 생성 - Service Role을 사용하여 RLS 우회
  const supabaseService = getServiceRoleClient()
  if (!supabaseService) {
    return { error: "서버 설정 오류가 발생했습니다. 관리자에게 문의해주세요." }
  }

  // 프로필이 이미 존재하는지 확인 (트리거가 먼저 생성했을 수 있음)
  const { data: existingProfile } = await supabaseService
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (!existingProfile) {
    // 프로필 생성 시도 (최대 3회, 지수 백오프)
    let profileCreated = false
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }

      const { error: profileError } = await supabaseService
        .from("profiles")
        .insert({ id: userId, email, full_name: fullName, phone, role, referring_driver_id: referringDriverId })

      if (!profileError) {
        profileCreated = true
        break
      }

      // 중복 키 = 다른 경로(트리거 등)가 이미 생성
      if (profileError.code === "23505") {
        profileCreated = true
        break
      }

      if (profileError.message.includes("schema cache") || profileError.message.includes("not found")) {
        return { error: `데이터베이스 테이블이 생성되지 않았습니다. 에러: ${profileError.message}` }
      }

      if (attempt === 2) {
        return { error: `프로필 생성 실패: ${profileError.message}` }
      }
    }

    if (!profileCreated) {
      return { error: "프로필 생성에 실패했습니다. 잠시 후 다시 시도해주세요." }
    }
  }
  
  // 배송원인 경우 driver_info + riders 병렬 생성
  if (role === "driver") {
    const vehicleType = formData.get("vehicleType") as string
    const vehicleNumber = formData.get("vehicleNumber") as string
    const licenseNumber = formData.get("licenseNumber") as string

    const [{ data: existingDriverInfo }, { data: existingRider }] = await Promise.all([
      supabaseService.from("driver_info").select("id").eq("id", userId).maybeSingle(),
      supabaseService.from("riders").select("id").eq("id", userId).maybeSingle(),
    ])

    const driverInfoPromise = existingDriverInfo
      ? supabaseService.from("driver_info").update({
          vehicle_type: vehicleType || null,
          vehicle_number: vehicleNumber || null,
          license_number: licenseNumber || null,
        }).eq("id", userId)
      : supabaseService.from("driver_info").insert({
          id: userId,
          vehicle_type: vehicleType || null,
          vehicle_number: vehicleNumber || null,
          license_number: licenseNumber || null,
        })

    const riderPromise = existingRider
      ? Promise.resolve()
      : (async () => {
          for (let attempt = 0; attempt < 5; attempt++) {
            const riderCode = `R${Math.floor(100000 + Math.random() * 900000)}`
            const { error } = await supabaseService.from("riders").insert({ id: userId, code: riderCode })
            if (!error || error.code === "23505") break
          }
        })()

    await Promise.all([driverInfoPromise, riderPromise])
  }

  if (role === "customer") {
    const { error: customerInsertError } = await supabaseService
      .from("customers")
      .insert({ id: userId })
      .select()
      .maybeSingle()

    if (customerInsertError && customerInsertError.code !== "23505") {
      console.error("Customer record creation error:", customerInsertError)
    }

    const referralStore = await cookies()
    const referralCode = referralStore.get("rider_referral_code")?.value

    if (referralCode) {
      const headerList = await headers()
      const ip =
        headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headerList.get("x-real-ip") ||
        "0.0.0.0"
      const ua = headerList.get("user-agent") || ""
      const existingSession = referralStore.get("rider_referral_session")?.value
      const sessionId = existingSession || crypto.randomUUID()

      const { data: referralResult, error: referralError } = await supabaseService.rpc(
        "confirm_customer_referral_for_customer",
        {
          p_customer_id: userId,
          p_code: referralCode,
          p_ip: ip,
          p_ua: ua,
          p_session_id: sessionId,
        },
      )

      if (!referralError && referralResult?.status === "assigned") {
        if (referralResult?.rider_id) {
          const { error: profileReferralError } = await supabaseService
            .from("profiles")
            .update({ referring_driver_id: referralResult.rider_id })
            .eq("id", userId)
          if (profileReferralError) {
            console.error("Profile referral update error:", profileReferralError)
          }
        }
        referralStore.delete("rider_referral_code")
      }
    } else {
      await confirmReferralFromCookie()
    }
  }

  const roleStore = await cookies()
  roleStore.delete("role_override")

  revalidatePath("/", "layout")
  const redirectTarget = role === "driver" ? "/driver" : role === "admin" ? "/admin" : "/customer"
  if (authData.session) {
    redirect(redirectTarget)
  }
  redirect("/auth/verify-email")
}

export async function signIn(formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    let errorMessage = error.message
    if (error.message.includes("Invalid login credentials")) {
      errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다."
    } else if (error.message.includes("Email not confirmed")) {
      errorMessage = "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요."
    } else if (error.message.includes("User already registered")) {
      errorMessage = "이미 등록된 사용자입니다. 로그인해주세요."
    }
    return { error: errorMessage }
  }

  if (!data.user) {
    return { error: "로그인에 실패했습니다. 다시 시도해주세요." }
  }

  if (!data.user.email_confirmed_at) {
    redirect("/auth/verify-email")
  }

  // 프로필 조회 — 일반 클라이언트로 먼저 시도
  let { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()

  // 프로필이 없거나 RLS로 조회 실패 시 Service Role로 재시도
  if (!profile) {
    const svc = getServiceRoleClient()
    if (svc) {
      const { data: svcProfile } = await svc
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle()

      if (svcProfile) {
        profile = svcProfile
      } else {
        // 프로필이 실제로 없으면 metadata로 생성 시도 (1회)
        const meta = data.user.user_metadata || {}
        const { data: newProfile } = await svc
          .from("profiles")
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: meta.full_name || "사용자",
            phone: meta.phone || "",
            role: meta.role || "customer",
            referring_driver_id: meta.referring_driver_id || null,
          })
          .select("role")
          .single()

        if (newProfile) {
          profile = newProfile
        } else {
          redirect("/auth/signup?error=profile_missing")
        }
      }
    } else {
      redirect("/auth/signup?error=profile_missing")
    }
  }

  if (profile.role === "customer") {
    await confirmReferralFromCookie()
  }

  const redirectTo =
    profile.role === "admin" ? "/admin" : profile.role === "driver" ? "/driver" : "/customer"

  return { success: true, role: profile.role, redirectTo }
}

export async function signOut() {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return { user, profile }
}
