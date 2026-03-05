"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { saveCompanyInfo, uploadCompanyImage, deleteCompanyImage } from "@/lib/actions/company"
import type { CompanyInfo } from "@/lib/actions/company"
import { Building2, Upload, Trash2, CheckCircle, AlertCircle, ImageIcon } from "lucide-react"

interface CompanyFormProps {
  initialData: CompanyInfo | null
}

export function CompanyForm({ initialData }: CompanyFormProps) {
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const [logoUrl, setLogoUrl] = useState<string | null>(initialData?.logo_url ?? null)
  const [stampUrl, setStampUrl] = useState<string | null>(initialData?.stamp_url ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [stampUploading, setStampUploading] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const stampInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    const formData = new FormData(e.currentTarget)
    queueMicrotask(async () => {
      try {
        const result = await saveCompanyInfo(formData)
        if (result.error) {
          showMessage("error", result.error)
        } else {
          showMessage("success", "회사 정보가 저장되었습니다.")
        }
      } catch (err: any) {
        showMessage("error", err?.message ?? "저장 중 오류가 발생했습니다.")
      } finally {
        setIsPending(false)
      }
    })
  }

  async function handleImageUpload(file: File, type: "logo" | "stamp") {
    const label = type === "logo" ? "로고" : "도장"
    const setter = type === "logo" ? setLogoUploading : setStampUploading
    setter(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const result = await uploadCompanyImage(fd, type)
      if (result.error) {
        showMessage("error", result.error)
      } else {
        if (type === "logo") setLogoUrl(result.url ?? null)
        else setStampUrl(result.url ?? null)
        showMessage("success", `${label} 이미지가 업로드되었습니다.`)
      }
    } catch (err: any) {
      showMessage("error", err?.message ?? `${label} 업로드 중 오류가 발생했습니다.`)
    } finally {
      setter(false)
    }
  }

  async function handleImageDelete(type: "logo" | "stamp") {
    const label = type === "logo" ? "로고" : "도장"
    try {
      const result = await deleteCompanyImage(type)
      if (result.error) {
        showMessage("error", result.error)
      } else {
        if (type === "logo") setLogoUrl(null)
        else setStampUrl(null)
        showMessage("success", `${label} 이미지가 삭제되었습니다.`)
      }
    } catch (err: any) {
      showMessage("error", err?.message ?? `${label} 삭제 중 오류가 발생했습니다.`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 저장/오류 메시지 — 상단 고정 */}
      {message && (
        <Alert
          variant={message.type === "error" ? "destructive" : "default"}
          className={message.type === "success" ? "border-green-300 bg-green-50 text-green-900" : ""}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription className="font-medium">{message.text}</AlertDescription>
        </Alert>
      )}

      {/* 이미지 관리 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 로고 이미지 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              로고 이미지
            </CardTitle>
            <CardDescription>
              헤더에 표시되는 로고입니다. 없으면 기본 이미지(/logo.png)가 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed bg-muted/30">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="회사 로고"
                  width={80}
                  height={80}
                  className="object-contain rounded-lg max-h-20"
                  unoptimized
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto h-8 w-8 mb-1" />
                  <p className="text-xs">이미지 없음 (기본 로고 사용)</p>
                </div>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, "logo")
                e.target.value = ""
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {logoUploading ? "업로드 중..." : "업로드"}
              </Button>
              {logoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-600 hover:text-red-700"
                  onClick={() => handleImageDelete("logo")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 도장 이미지 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              도장 이미지
            </CardTitle>
            <CardDescription>
              고객 영수증 출력 시 회사명 옆에 자동으로 표시됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed bg-muted/30">
              {stampUrl ? (
                <Image
                  src={stampUrl}
                  alt="회사 도장"
                  width={80}
                  height={80}
                  className="object-contain max-h-20"
                  unoptimized
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto h-8 w-8 mb-1" />
                  <p className="text-xs">도장 이미지 없음</p>
                </div>
              )}
            </div>
            <input
              ref={stampInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, "stamp")
                e.target.value = ""
              }}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                disabled={stampUploading}
                onClick={() => stampInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {stampUploading ? "업로드 중..." : "업로드"}
              </Button>
              {stampUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-red-600 hover:text-red-700"
                  onClick={() => handleImageDelete("stamp")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  삭제
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* 회사 기본 정보 폼 */}
      <form ref={formRef} onSubmit={handleSave} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="company_name">
              회사명 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="company_name"
              name="company_name"
              defaultValue={initialData?.company_name ?? "퀵HW언넌"}
              placeholder="퀵HW언넌"
              required
            />
            <p className="text-xs text-muted-foreground">헤더 텍스트 및 영수증 회사명에 반영됩니다.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business_number">사업자등록번호</Label>
            <Input
              id="business_number"
              name="business_number"
              defaultValue={initialData?.business_number ?? ""}
              placeholder="000-00-00000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ceo_name">대표자명</Label>
            <Input
              id="ceo_name"
              name="ceo_name"
              defaultValue={initialData?.ceo_name ?? ""}
              placeholder="홍길동"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">대표 전화</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              defaultValue={initialData?.contact_phone ?? ""}
              placeholder="02-0000-0000"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="company_address">회사 주소</Label>
            <Input
              id="company_address"
              name="company_address"
              defaultValue={initialData?.company_address ?? ""}
              placeholder="서울특별시 강남구 ..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_email">이메일</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={initialData?.contact_email ?? ""}
              placeholder="info@quickhw.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url">웹사이트</Label>
            <Input
              id="website_url"
              name="website_url"
              defaultValue={initialData?.website_url ?? ""}
              placeholder="https://quickhw.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kakao_channel">카카오 채널</Label>
            <Input
              id="kakao_channel"
              name="kakao_channel"
              defaultValue={initialData?.kakao_channel ?? ""}
              placeholder="@퀵HW언넌"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isPending} className="gap-2 min-w-[120px]">
            <Building2 className="h-4 w-4" />
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </div>
  )
}
