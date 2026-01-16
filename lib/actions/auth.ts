"use server"

import { getSupabaseServerClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signUp(formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const phone = formData.get("phone") as string
  const role = (formData.get("role") as string) || "customer"

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
  // 트리거가 있으면 자동으로 생성되지만, 없을 경우를 대비해 수동으로도 생성 시도
  const { createClient: createServiceClient } = await import("@supabase/supabase-js")
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    console.error("Service Role Key가 설정되지 않았습니다.")
    return { error: "서버 설정 오류가 발생했습니다. 관리자에게 문의해주세요." }
  }
  
  const supabaseService = createServiceClient(
    process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
    serviceRoleKey
  )
  
  // 프로필 생성 - 사용자가 auth.users에 존재하는지 확인 후 생성
  console.log("Creating profile for user:", userId)
  
  // Supabase signUp 후 사용자가 auth.users에 커밋될 때까지 대기 (최대 15초)
  // Foreign key constraint를 통과하려면 사용자가 실제로 auth.users 테이블에 존재해야 함
  console.log("Waiting for user to be committed to auth.users...")
  await new Promise(resolve => setTimeout(resolve, 3000)) // 초기 3초 대기
  
  // 사용자가 auth.users에 실제로 존재하는지 확인 (최대 15초 대기)
  let userExists = false
  for (let i = 0; i < 30; i++) {
    try {
      const { data: userData, error: userError } = await supabaseService.auth.admin.getUserById(userId)
      
      if (!userError && userData?.user) {
        console.log(`✅ User exists in auth.users (attempt ${i + 1}/30), proceeding with profile creation...`)
        userExists = true
        break
      } else {
        console.log(`⏳ User check attempt ${i + 1}/30: User not found yet, waiting...`)
      }
    } catch (error) {
      console.log(`⏳ User check attempt ${i + 1}/30 failed, retrying...`)
    }
    
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  if (!userExists) {
    console.warn("⚠️ User not found in auth.users after 15 seconds, but proceeding anyway...")
  }
  
  // 프로필 생성 시도 (최대 5회 재시도)
  let profileCreated = false
  let retryCount = 0
  const maxRetries = 5
  
  while (!profileCreated && retryCount < maxRetries) {
    // 먼저 프로필이 이미 생성되었는지 확인
    const { data: existingProfile } = await supabaseService
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single()
    
    if (existingProfile) {
      console.log("Profile already exists!")
      profileCreated = true
      break
    }
    
    // 프로필 생성 시도
    console.log(`Attempting profile creation (attempt ${retryCount + 1}/${maxRetries})...`)
    console.log("Profile data:", { id: userId, email, full_name: fullName, phone, role })
    
    const { error: profileError, data: profileData } = await supabaseService
      .from("profiles")
      .insert({
        id: userId,
        email,
        full_name: fullName,
        phone,
        role,
      })
      .select()
      .single()
    
    if (!profileError) {
      console.log("✅ Profile created successfully!")
      console.log("Profile data:", profileData)
      profileCreated = true
      break
    }
    
    console.error(`❌ Profile creation attempt ${retryCount + 1}/${maxRetries} failed:`)
    console.error("Error message:", profileError.message)
    console.error("Error code:", profileError.code)
    console.error("Error hint:", profileError.hint)
    console.error("Error details:", JSON.stringify(profileError, null, 2))
    console.error("User ID:", userId)
    console.error("Email:", email)
    
    // 사용자 존재 여부 재확인
    try {
      const { data: userCheck, error: userCheckError } = await supabaseService.auth.admin.getUserById(userId)
      console.log("User check during error:", userCheck ? "✅ User exists" : "❌ User not found")
      console.log("User check error:", userCheckError)
      if (userCheck?.user) {
        console.log("User email:", userCheck.user.email)
        console.log("User created_at:", userCheck.user.created_at)
      }
    } catch (error) {
      console.error("User check failed:", error)
    }
    
    // 중복 키 에러는 무시 (다른 프로세스가 생성했을 수 있음)
    if (profileError.message.includes("duplicate key") || 
        profileError.message.includes("unique constraint") ||
        profileError.code === '23505') {
      console.log("Profile already exists (duplicate key), checking...")
      
      // 실제로 존재하는지 확인
      const { data: checkProfile } = await supabaseService
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single()
      
      if (checkProfile) {
        console.log("Profile exists, continuing...")
        profileCreated = true
        break
      }
    } else if (profileError.message.includes("foreign key constraint") || profileError.code === '23503') {
      // Foreign key 에러는 사용자가 아직 auth.users에 없을 수 있음
      // 사용자 존재 여부 다시 확인
      console.log(`🔴 Foreign key constraint error (attempt ${retryCount + 1}/${maxRetries})`)
      console.log(`   Error details: ${profileError.details || profileError.message}`)
      console.log(`   Checking if user exists in auth.users...`)
      
      let userFoundInAuth = false
      for (let checkAttempt = 0; checkAttempt < 10; checkAttempt++) {
        try {
          const { data: userCheck, error: userCheckError } = await supabaseService.auth.admin.getUserById(userId)
          if (!userCheckError && userCheck?.user) {
            console.log(`   ✅ User found in auth.users (check attempt ${checkAttempt + 1}/10)`)
            userFoundInAuth = true
            break
          } else {
            console.log(`   ⏳ User not found in auth.users yet (check attempt ${checkAttempt + 1}/10)`)
          }
        } catch (error) {
          console.log(`   ⏳ User check failed (check attempt ${checkAttempt + 1}/10)`)
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      if (!userFoundInAuth) {
        console.error(`   ❌ User still not found in auth.users after additional checks`)
        console.error(`   This may indicate a problem with Supabase user creation`)
      }
      
      // 더 오래 대기 후 재시도 (지수 백오프: 5초, 10초, 15초, 20초, 25초)
      const waitTime = 5000 * (retryCount + 1)
      console.log(`   ⏳ Waiting ${waitTime}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      retryCount++
      continue
    } else if (profileError.message.includes("schema cache") || profileError.message.includes("not found")) {
      return { 
        error: `데이터베이스 테이블이 생성되지 않았습니다. Supabase 대시보드에서 SQL 스크립트를 실행해주세요.\n\n에러: ${profileError.message}` 
      }
    } else {
      // 다른 에러인 경우 상세 정보와 함께 반환
      retryCount++
      if (retryCount >= maxRetries) {
        return { 
          error: `프로필 생성 실패: ${profileError.message}\n\n에러 코드: ${profileError.code}\n\n시도 횟수: ${maxRetries}회\n\n관리자에게 문의해주세요.` 
        }
      }
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  if (!profileCreated) {
    return { 
      error: `프로필 생성에 실패했습니다. 사용자가 아직 완전히 생성되지 않았을 수 있습니다.\n\n에러 상세: 프로필 생성 시도 ${maxRetries}회 모두 실패했습니다.\n\n해결 방법:\n1. 잠시 후 다시 시도해주세요.\n2. Supabase 대시보드에서 사용자가 생성되었는지 확인하세요.\n3. 문제가 계속되면 관리자에게 문의해주세요.` 
    }
  }
  
  // 배송원인 경우 driver_info 테이블에도 레코드 생성 (차량 정보 포함)
  if (role === "driver") {
    const vehicleType = formData.get("vehicleType") as string
    const vehicleNumber = formData.get("vehicleNumber") as string
    const licenseNumber = formData.get("licenseNumber") as string
    
    // 기존 driver_info가 있는지 확인
    const { data: existingDriverInfo } = await supabaseService
      .from("driver_info")
      .select("id")
      .eq("id", userId)
      .single()
    
    if (!existingDriverInfo) {
      // 새로 생성
      const { error: driverError } = await supabaseService.from("driver_info").insert({
        id: userId,
        vehicle_type: vehicleType || null,
        vehicle_number: vehicleNumber || null,
        license_number: licenseNumber || null,
      }).select().single()
      
      if (driverError) {
        // 중복 키 에러는 무시 (트리거가 이미 생성했을 수 있음)
        if (!driverError.message.includes("duplicate key") && 
            !driverError.message.includes("unique constraint") &&
            driverError.code !== '23505') {
          console.error("Driver info creation error:", driverError)
          console.warn("Driver info creation failed, but profile was created:", driverError.message)
        }
      }
    } else {
      // 기존 레코드 업데이트
      const { error: updateError } = await supabaseService
        .from("driver_info")
        .update({
          vehicle_type: vehicleType || null,
          vehicle_number: vehicleNumber || null,
          license_number: licenseNumber || null,
        })
        .eq("id", userId)
      
      if (updateError) {
        console.error("Driver info update error:", updateError)
      }
    }
  }

  revalidatePath("/", "layout")
  redirect("/auth/verify-email")
}

export async function signIn(formData: FormData) {
  const supabase = await getSupabaseServerClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // 에러 메시지 한글화
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

  // 사용자 역할에 따라 리다이렉트
  if (data.user) {
    // 이메일 확인 여부 확인
    if (!data.user.email_confirmed_at) {
      revalidatePath("/", "layout")
      redirect("/auth/verify-email")
    }

    // 프로필 조회 - maybeSingle() 사용하여 에러 없이 처리
    let { data: profile, error: profileQueryError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle()

    // 프로필 조회 에러가 발생한 경우 (RLS 정책 위반 등)
    if (profileQueryError) {
      console.error("Profile query error:", profileQueryError)
      // Service Role을 사용하여 프로필 존재 여부 확인
      const { createClient: createServiceClient } = await import("@supabase/supabase-js")
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (serviceRoleKey) {
        const supabaseService = createServiceClient(
          process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
          serviceRoleKey
        )
        
        // Service Role로 프로필 조회 시도
        const { data: serviceProfile } = await supabaseService
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle()
        
        if (serviceProfile) {
          console.log("Profile found using service role, using it...")
          profile = serviceProfile
        }
      }
    }

    // 프로필이 없는 경우 자동 생성 시도
    if (!profile) {
      console.log("Profile not found, attempting to create from user metadata...")
      
      // 사용자 metadata에서 정보 가져오기
      const userMetadata = data.user.user_metadata || {}
      const fullName = userMetadata.full_name || ""
      const phone = userMetadata.phone || ""
      const role = userMetadata.role || "customer"
      
      // Service Role을 사용하여 프로필 생성
      const { createClient: createServiceClient } = await import("@supabase/supabase-js")
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (serviceRoleKey) {
        const supabaseService = createServiceClient(
          process.env.NEXT_PUBLIC_QUICKSUPABASE_URL!,
          serviceRoleKey
        )
        
        // 프로필 생성 시도 (최대 3회 재시도)
        let profileCreated = false
        for (let attempt = 1; attempt <= 3; attempt++) {
          // 사용자가 auth.users에 존재하는지 확인
          try {
            const { data: userData, error: userError } = await supabaseService.auth.admin.getUserById(data.user.id)
            if (userError || !userData?.user) {
              console.log(`User check failed (attempt ${attempt}/3), waiting...`)
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
              continue
            }
          } catch (e) {
            console.log(`User check error (attempt ${attempt}/3):`, e)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
            continue
          }
          
          // 프로필 생성 시도
          const { data: newProfile, error: profileError } = await supabaseService
            .from("profiles")
            .insert({
              id: data.user.id,
              email: data.user.email!,
              full_name: fullName || "사용자",
              phone: phone || "",
              role: role || "customer",
            })
            .select()
            .single()
          
          if (!profileError && newProfile) {
            console.log(`Profile created successfully (attempt ${attempt}/3)`)
            profile = newProfile
            profileCreated = true
            break
          } else {
            console.error(`Profile creation failed (attempt ${attempt}/3):`, profileError)
            
            // 중복 키 에러인 경우 - 프로필이 이미 존재함
            if (profileError?.code === "23505") {
              console.log("Profile already exists (duplicate key), fetching existing profile...")
              
              // 기존 프로필 조회
              const { data: existingProfile } = await supabaseService
                .from("profiles")
                .select("role")
                .eq("id", data.user.id)
                .maybeSingle()
              
              if (existingProfile) {
                console.log("Existing profile found and retrieved")
                profile = existingProfile
                profileCreated = true
                break
              }
            }
            
            // Foreign key constraint 에러인 경우 더 오래 대기
            if (profileError?.code === "23503" && attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
              continue
            }
          }
        }
        
        if (!profileCreated) {
          console.error("Could not create profile after retries, redirecting to signup")
          revalidatePath("/", "layout")
          redirect("/auth/signup?error=profile_missing")
        }
      } else {
        console.error("Service Role Key not found, redirecting to signup")
        revalidatePath("/", "layout")
        redirect("/auth/signup?error=profile_missing")
      }
    }

    revalidatePath("/", "layout")

    // redirect() 대신 성공 여부와 역할을 반환하여 클라이언트에서 리다이렉트 처리
    // 서버 사이드 redirect()는 클라이언트 컴포넌트와 충돌할 수 있음
    if (!profile) {
      return { error: "프로필 정보를 찾을 수 없습니다." }
    }
    
    return { 
      success: true, 
      role: profile.role,
      redirectTo: profile.role === "admin" ? "/admin" : profile.role === "driver" ? "/driver" : "/customer"
    }
  }

  return { error: "로그인에 실패했습니다. 다시 시도해주세요." }
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
