"use client"

import { signUp } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, CheckCircle2, ImagePlus, Shield, Truck, UserCheck, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useState, useTransition, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"

type UploadedDoc = { path: string; previewUrl: string }

function SignUpForm() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [role, setRole] = useState<string>("customer")

  // 약관 동의 (공통 + 배송원 전용)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [serviceAgreed, setServiceAgreed] = useState(false)
  const [insuranceAgreed, setInsuranceAgreed] = useState(false)

  // 휴대폰 OTP 상태
  const [phone, setPhone] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null)
  const [sendCooldown, setSendCooldown] = useState(0)
  const [isSendingOtp, startSendOtp] = useTransition()
  const [isVerifyingOtp, startVerifyOtp] = useTransition()
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 약관 모달
  const [termsModal, setTermsModal] = useState<"privacy" | "service" | "insurance" | null>(null)

  // 사진 업로드 상태
  const [licenseDoc, setLicenseDoc] = useState<UploadedDoc | null>(null)
  const [vehicleDoc, setVehicleDoc] = useState<UploadedDoc | null>(null)
  const [uploadingLicense, setUploadingLicense] = useState(false)
  const [uploadingVehicle, setUploadingVehicle] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const licenseInputRef = useRef<HTMLInputElement>(null)
  const vehicleInputRef = useRef<HTMLInputElement>(null)

  const riderCodeFromLink = searchParams.get("rider") ?? null

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "profile_missing") {
      setError("프로필 정보가 없습니다. 회원가입을 완료해주세요.")
    }
  }, [searchParams])

  // 쿨다운 타이머
  useEffect(() => {
    if (sendCooldown <= 0) return
    cooldownRef.current = setInterval(() => {
      setSendCooldown((v) => {
        if (v <= 1) { clearInterval(cooldownRef.current!); return 0 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(cooldownRef.current!)
  }, [sendCooldown])

  async function handleSendOtp() {
    setOtpError(null)
    setOtpSuccess(null)
    startSendOtp(async () => {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error || "SMS 발송에 실패했습니다."); return }
      setOtpSent(true)
      setOtpSuccess("인증번호가 발송되었습니다. (5분 이내 입력)")
      setSendCooldown(60)
    })
  }

  async function handleVerifyOtp() {
    setOtpError(null)
    startVerifyOtp(async () => {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) { setOtpError(data.error || "인증에 실패했습니다."); return }
      setPhoneVerified(true)
      setOtpSuccess("휴대폰 인증이 완료되었습니다.")
      setOtpError(null)
    })
  }

  async function handleUploadDoc(file: File, docType: "license" | "vehicle") {
    setUploadError(null)
    const setter = docType === "license" ? setUploadingLicense : setUploadingVehicle

    setter(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("docType", docType)
      fd.append("tempId", phone.replace(/\D/g, "") || "unknown")

      const res = await fetch("/api/upload/driver-docs", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok) { setUploadError(data.error || "업로드 실패"); return }

      const doc: UploadedDoc = {
        path: data.path,
        previewUrl: URL.createObjectURL(file),
      }
      if (docType === "license") setLicenseDoc(doc)
      else setVehicleDoc(doc)
    } finally {
      setter(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null)

    if (!phoneVerified) { setError("휴대폰 인증을 완료해주세요."); return }
    if (!privacyAgreed || !serviceAgreed) { setError("필수 약관에 동의해주세요."); return }

    if (role === "driver") {
      if (!insuranceAgreed) { setError("보험 안내 약관에 동의해주세요."); return }
    }

    formData.set("role", role)
    formData.set("phone", phone)
    formData.set("privacyAgreed", "true")
    formData.set("serviceAgreed", "true")
    formData.set("insuranceAgreed", insuranceAgreed ? "true" : "false")
    if (licenseDoc) formData.set("licensePhotoPath", licenseDoc.path)
    if (vehicleDoc) formData.set("vehiclePhotoPath", vehicleDoc.path)

    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">퀵HW언넌 회원가입</CardTitle>
          <CardDescription className="text-center">새 계정을 만들어 서비스를 시작하세요</CardDescription>
        </CardHeader>
        <CardContent>
          {riderCodeFromLink && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <UserCheck className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-sm">
                기사 <strong>{riderCodeFromLink}</strong> 님의 소개로 가입하고 있습니다.
                회원가입 완료 후 자동으로 연결됩니다.
              </AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">이름</Label>
              <Input id="fullName" name="fullName" type="text" placeholder="홍길동" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" name="email" type="email" placeholder="your@email.com" required />
            </div>

            {/* 휴대폰 OTP 인증 */}
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <div className="flex gap-2">
                <Input
                  id="phone"
                  type="tel"
                  placeholder="010-1234-5678"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setPhoneVerified(false)
                    setOtpSent(false)
                    setOtpCode("")
                    setOtpError(null)
                    setOtpSuccess(null)
                  }}
                  disabled={phoneVerified}
                  className={phoneVerified ? "bg-green-50 border-green-300" : ""}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 w-28"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp || phoneVerified || !phone || sendCooldown > 0}
                >
                  {isSendingOtp
                    ? "발송 중..."
                    : sendCooldown > 0
                      ? `${sendCooldown}초`
                      : otpSent
                        ? "재발송"
                        : "인증번호 발송"}
                </Button>
              </div>

              {otpSent && !phoneVerified && (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="인증번호 6자리"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 w-28"
                    onClick={handleVerifyOtp}
                    disabled={isVerifyingOtp || otpCode.length !== 6}
                  >
                    {isVerifyingOtp ? "확인 중..." : "확인"}
                  </Button>
                </div>
              )}

              {otpError && (
                <p className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {otpError}
                </p>
              )}
              {otpSuccess && (
                <p className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {otpSuccess}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required minLength={6} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">가입 유형</Label>
              <div className="flex items-center gap-2">
                <Select name="role" value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">고객</SelectItem>
                    <SelectItem value="driver">배송원</SelectItem>
                  </SelectContent>
                </Select>
                {role === "customer" && riderCodeFromLink && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                    <UserCheck className="h-3.5 w-3.5" />
                    추천코드 {riderCodeFromLink}
                  </span>
                )}
              </div>
            </div>

            {/* 배송원 추가 정보 */}
            {role === "driver" && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    차량 종류
                  </Label>
                  <input type="hidden" name="vehicleType" value="motorcycle" />
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed">
                    오토바이
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicleNumber">차량 번호</Label>
                  <Input id="vehicleNumber" name="vehicleNumber" placeholder="12가3456" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">면허 번호</Label>
                  <Input id="licenseNumber" name="licenseNumber" placeholder="면허 번호" />
                </div>

                {/* 사진 업로드 */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-blue-900">서류 사진 업로드</p>
                  {uploadError && (
                    <p className="flex items-center gap-1 text-sm text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" />{uploadError}
                    </p>
                  )}

                  {/* 면허증 사진 */}
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-800">면허증 사진 <span className="text-red-500">*</span></Label>
                    <input
                      ref={licenseInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadDoc(f, "license")
                      }}
                    />
                    {licenseDoc ? (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-blue-200">
                        <Image src={licenseDoc.previewUrl} alt="면허증" fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => { setLicenseDoc(null); if (licenseInputRef.current) licenseInputRef.current.value = "" }}
                          className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> 업로드 완료
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => licenseInputRef.current?.click()}
                        disabled={uploadingLicense}
                        className="w-full h-24 border-2 border-dashed border-blue-300 rounded-lg flex flex-col items-center justify-center gap-1 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
                      >
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-xs">{uploadingLicense ? "업로드 중..." : "면허증 사진 선택"}</span>
                      </button>
                    )}
                  </div>

                  {/* 차량 사진 */}
                  <div className="space-y-1">
                    <Label className="text-sm text-blue-800">차량 사진 <span className="text-red-500">*</span></Label>
                    <input
                      ref={vehicleInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleUploadDoc(f, "vehicle")
                      }}
                    />
                    {vehicleDoc ? (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-blue-200">
                        <Image src={vehicleDoc.previewUrl} alt="차량" fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => { setVehicleDoc(null); if (vehicleInputRef.current) vehicleInputRef.current.value = "" }}
                          className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> 업로드 완료
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => vehicleInputRef.current?.click()}
                        disabled={uploadingVehicle}
                        className="w-full h-24 border-2 border-dashed border-blue-300 rounded-lg flex flex-col items-center justify-center gap-1 text-blue-600 hover:bg-blue-100 transition disabled:opacity-50"
                      >
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-xs">{uploadingVehicle ? "업로드 중..." : "차량 사진 선택"}</span>
                      </button>
                    )}
                  </div>
                </div>

                <Alert className="border-orange-200 bg-orange-50">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800 text-sm">
                    <strong>보험 안내:</strong> 플랫폼 단체 물품 보험이 적용됩니다.
                    보상 한도는 약관에 명시되어 있습니다.
                  </AlertDescription>
                </Alert>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="insuranceAgreed"
                    checked={insuranceAgreed}
                    onCheckedChange={(checked) => setInsuranceAgreed(checked === true)}
                  />
                  <Label htmlFor="insuranceAgreed" className="text-sm leading-snug">
                    플랫폼 보험 적용 범위를 확인했으며 동의합니다.{" "}
                    <button type="button" onClick={() => setTermsModal("insurance")} className="underline text-blue-600">약관 보기</button>
                  </Label>
                </div>
              </div>
            )}

            {/* 공통 필수 약관 동의 */}
            <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
              <p className="text-sm font-medium text-gray-700">필수 약관 동의</p>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="privacyAgreed"
                  checked={privacyAgreed}
                  onCheckedChange={(checked) => setPrivacyAgreed(checked === true)}
                />
                <Label htmlFor="privacyAgreed" className="text-sm leading-snug">
                  <span className="text-red-500 font-medium">[필수]</span> 개인정보 처리방침에 동의합니다.{" "}
                  <button type="button" onClick={() => setTermsModal("privacy")} className="underline text-blue-600">보기</button>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="serviceAgreed"
                  checked={serviceAgreed}
                  onCheckedChange={(checked) => setServiceAgreed(checked === true)}
                />
                <Label htmlFor="serviceAgreed" className="text-sm leading-snug">
                  <span className="text-red-500 font-medium">[필수]</span> 서비스 이용약관에 동의합니다.{" "}
                  <button type="button" onClick={() => setTermsModal("service")} className="underline text-blue-600">보기</button>
                </Label>
              </div>
            </div>

            {/* 약관 모달 */}
            <Dialog open={termsModal !== null} onOpenChange={(open) => { if (!open) setTermsModal(null) }}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {termsModal === "privacy" && "개인정보 처리방침"}
                    {termsModal === "service" && "서비스 이용약관"}
                    {termsModal === "insurance" && "보험 안내 약관"}
                  </DialogTitle>
                </DialogHeader>

                {termsModal === "privacy" && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-1">제1조 (개인정보의 처리 목적)</p>
                      <p>퀵HW언넌(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않습니다.</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 pl-2">
                        <li>회원 가입 및 관리: 회원 식별, 서비스 이용 계약 이행</li>
                        <li>배송 서비스 제공: 기사-고객 매칭, 배송 현황 안내</li>
                        <li>결제 처리: 요금 결제 및 정산</li>
                        <li>고객 문의 및 사고 접수 처리</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제2조 (처리하는 개인정보 항목)</p>
                      <p className="mb-1"><strong>고객 회원:</strong> 이름, 이메일, 비밀번호(암호화), 휴대폰 번호, 서비스 이용 기록</p>
                      <p><strong>배송원 회원:</strong> 이름, 이메일, 비밀번호(암호화), 휴대폰 번호, 차량 정보, 면허 번호, 위치 정보(배송 중)</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제3조 (개인정보 보유 기간)</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>회원 정보: 회원 탈퇴 시까지</li>
                        <li>거래·결제 기록: 5년 (전자상거래법)</li>
                        <li>접속 로그: 3개월 (통신비밀보호법)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제4조 (제3자 제공)</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>결제 처리: 토스페이먼츠 (결제 정보)</li>
                        <li>SMS 인증: 솔라피 (휴대폰 번호)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제5조 (정보주체의 권리)</p>
                      <p>개인정보 열람·정정·삭제·처리정지 요구는 고객 대시보드 내 문의하기를 통해 행사할 수 있습니다.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제6조 (안전성 확보 조치)</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>비밀번호 단방향 암호화(bcrypt) 저장</li>
                        <li>통신 구간 HTTPS/TLS 암호화</li>
                        <li>역할 기반 접근 제어(RLS) 적용</li>
                      </ul>
                    </div>
                  </div>
                )}

                {termsModal === "service" && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-1">제1조 (목적)</p>
                      <p>본 약관은 퀵HW언넌(이하 "회사")가 제공하는 퀵배송 중개 서비스의 이용 조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제2조 (서비스의 성격)</p>
                      <p>회사는 <strong>운송 당사자가 아닌 중개 플랫폼</strong>입니다. 기사와 고객을 연결하고 거래를 기록하는 역할만 수행하며, 실제 운송 계약은 기사와 고객 간에 체결됩니다.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제3조 (요금)</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>기본 요금: 4,000원 (기본 2km 포함)</li>
                        <li>추가 거리: 1,000원/km</li>
                        <li>플랫폼 수수료: 현재 0% (향후 변경 시 사전 공지)</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제4조 (책임 한계)</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>인적 사고(상해·사망): 기사 개인 책임</li>
                        <li>물품 사고(파손·분실): 기사 + 플랫폼 보험 처리</li>
                        <li>플랫폼은 연결 서비스 제공 범위 내에서만 책임을 집니다</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제5조 (이용자 의무)</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>타인의 정보를 도용하거나 허위 정보를 제공하지 않을 것</li>
                        <li>서비스를 불법적인 목적으로 이용하지 않을 것</li>
                        <li>다른 이용자의 서비스 이용을 방해하지 않을 것</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">제6조 (서비스 변경 및 중단)</p>
                      <p>회사는 서비스 내용을 변경하거나 중단할 수 있으며, 중요한 변경 사항은 사전에 공지합니다.</p>
                    </div>
                  </div>
                )}

                {termsModal === "insurance" && (
                  <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground mb-1">플랫폼 단체 물품 보험 안내</p>
                      <p>퀵HW언넌 플랫폼을 통해 진행되는 배송 건에 한해 물품 사고 시 보험이 적용됩니다.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">보상 범위</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>물품 파손: 실제 손해액 (최대 100만원)</li>
                        <li>물품 분실: 실제 손해액 (최대 100만원)</li>
                        <li>인적 사고(상해·사망): 보상 불가 — 기사 개인 책임</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">보상 제외 사항</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-2">
                        <li>고의 또는 중대한 과실로 인한 사고</li>
                        <li>현금, 유가증권, 귀금속류</li>
                        <li>부패·변질되기 쉬운 물품</li>
                        <li>플랫폼 외부에서 직접 계약된 배송</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-1">사고 접수 방법</p>
                      <p>배송 완료 후 7일 이내에 고객 대시보드 → 사고 접수를 통해 신청하시기 바랍니다. 접수 후 1영업일 내 안내드립니다.</p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-orange-800 text-xs">본 보험은 플랫폼 단체 계약 보험으로, 세부 보상 조건은 실제 보험 약관에 따릅니다. 보험 가입 여부 및 세부 내용은 운영팀에 문의하세요.</p>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button onClick={() => setTermsModal(null)}>확인</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "처리 중..." : "회원가입"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
            <Link href="/auth/login" className="text-primary hover:underline">
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-yellow-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">퀵HW언넌 회원가입</CardTitle>
            <CardDescription className="text-center">로딩 중...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}
