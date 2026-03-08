"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Camera, ExternalLink, Image as ImageIcon, Video } from "lucide-react"

/** 플랫폼별 권한 가이드 및 설정 열기 URL */
function getCameraPermissionGuide() {
  if (typeof navigator === "undefined") return { guide: "", helpUrl: "", isInApp: false }
  const ua = navigator.userAgent
  const isInApp = /QuickHWDriverApp/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua)
  const isChrome = /Chrome|CriOS/i.test(ua)

  if (isInApp) {
    return {
      guide: "1. 기기 설정 → 앱 → 언넌 → 권한\n2. 카메라를 허용으로 변경\n3. 앱으로 돌아와 다시 시도",
      helpUrl: "",
      isInApp: true,
    }
  }
  if (isIOS) {
    return {
      guide: "1. 설정 → Safari → 카메라 허용\n2. 또는 설정 → 사이트 설정에서 이 사이트의 카메라 허용",
      helpUrl: "https://support.apple.com/ko-kr/HT203033",
      isInApp: false,
    }
  }
  if (isAndroid && isChrome) {
    return {
      guide: "1. 주소창 왼쪽 자물쇠 아이콘 탭\n2. 사이트 설정 → 권한 → 카메라 허용\n3. 또는 설정 → 사이트 설정 → 카메라",
      helpUrl: "https://support.google.com/chrome/answer/2693767?hl=ko",
      isInApp: false,
    }
  }
  if (isChrome) {
    return {
      guide: "1. 주소창 왼쪽 자물쇠(또는 아이콘) 클릭\n2. 사이트 설정 → 카메라 허용\n3. 또는 Chrome 설정 → 개인정보 및 보안 → 사이트 설정 → 카메라",
      helpUrl: "https://support.google.com/chrome/answer/2693767?hl=ko",
      isInApp: false,
    }
  }
  return {
    guide: "브라우저 설정에서 이 사이트의 카메라 권한을 허용해 주세요.",
    helpUrl: "https://support.google.com/chrome/answer/2693767?hl=ko",
    isInApp: false,
  }
}

interface DeliveryCompleteFormProps {
  deliveryId: string
  label?: React.ReactNode
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  /** accepted → delivered 한 번에 처리 (대시보드 등) */
  fromAccepted?: boolean
}

async function uploadBlob(deliveryId: string, blob: Blob): Promise<string> {
  const file = new File([blob], "capture.jpg", { type: "image/jpeg" })
  const formData = new FormData()
  formData.append("file", file)
  const res = await fetch(`/api/driver/delivery/${deliveryId}/upload-proof`, {
    method: "POST",
    body: formData,
    credentials: "include",
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || "업로드에 실패했습니다.")
  return data.url
}

export function DeliveryCompleteForm({
  deliveryId,
  label = "배송 완료",
  variant = "default",
  size = "lg",
  className,
  fromAccepted = false,
}: DeliveryCompleteFormProps) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [permissionRetrying, setPermissionRetrying] = useState(false)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)
  const [capturedUploadedUrl, setCapturedUploadedUrl] = useState<string | null>(null)
  const [cameraModalError, setCameraModalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async (isRetry = false) => {
    if (isRetry) setPermissionRetrying(true)
    setCameraError(null)
    setPermissionDenied(false)
    setCameraReady(false)
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraReady(true)
    } catch (e: unknown) {
      const err = e as DOMException
      if (err?.name === "NotAllowedError" || err?.code === 1) {
        setCameraError(
          "카메라 권한이 거부되었습니다. 브라우저 또는 앱 설정에서 카메라를 허용해 주세요. 허용 후 다시 시도하세요."
        )
        setPermissionDenied(true)
      } else if (err?.name === "NotFoundError") {
        setCameraError("카메라를 찾을 수 없습니다.")
      } else {
        setCameraError("카메라에 접근할 수 없습니다. 브라우저 설정에서 권한을 확인해 주세요.")
      }
    } finally {
      setPermissionRetrying(false)
    }
  }, [stopCamera])

  /** 권한 거부 시 도움말 페이지 자동 열기 (1회, 웹 전용·앱 내 WebView는 스킵) */
  const hasAutoOpenedHelp = useRef(false)
  useEffect(() => {
    if (!permissionDenied || hasAutoOpenedHelp.current || !cameraModalOpen) return
    hasAutoOpenedHelp.current = true
    const { helpUrl, isInApp } = getCameraPermissionGuide()
    if (helpUrl && !isInApp) {
      const w = window.open(helpUrl, "_blank", "noopener,noreferrer")
      if (!w) {
        window.location.href = helpUrl
      }
    }
  }, [permissionDenied, cameraModalOpen])

  useEffect(() => {
    if (!cameraModalOpen || !cameraReady || !videoRef.current) return
    const video = videoRef.current
    if (streamRef.current) video.srcObject = streamRef.current
    return () => {
      if (video?.srcObject) video.srcObject = null
    }
  }, [cameraModalOpen, cameraReady])

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.srcObject || video.readyState < 2) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    if (w < 1 || h < 1) {
      setCameraModalError("카메라 화면을 불러오는 중입니다. 잠시 후 다시 시도해주세요.")
      return
    }
    setLoading(true)
    setCameraModalError(null)
    try {
      const canvas = canvasRef.current || document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas not available")
      ctx.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      })
      if (!blob) {
        setCameraModalError("촬영 실패")
        setLoading(false)
        return
      }
      const url = await uploadBlob(deliveryId, blob)
      const dataUrl = URL.createObjectURL(blob)
      stopCamera()
      setCameraReady(false)
      setCapturedPreview(dataUrl)
      setCapturedUploadedUrl(url)
    } catch (err) {
      setCameraModalError(err instanceof Error ? err.message : "업로드에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }, [deliveryId, stopCamera])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setError(null)
    if (!f) return

    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(f.type)) {
      setError("JPG, PNG, WEBP, HEIC 형식만 가능합니다.")
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("파일 크기는 5MB 이하여야 합니다.")
      return
    }

    setPreview(URL.createObjectURL(f))
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", f)
      const res = await fetch(`/api/driver/delivery/${deliveryId}/upload-proof`, {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || "업로드에 실패했습니다.")
        setPreview(null)
        setLoading(false)
        return
      }
      setUploadedUrl(data.url)
    } catch {
      setError("업로드에 실패했습니다.")
      setPreview(null)
    } finally {
      setLoading(false)
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleComplete = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading || submitting) return
    const form = formRef.current
    if (!form) return
    setSubmitting(true)
    setError(null)
    try {
      const fd = new FormData(form)
      fd.set("delivery_proof_url", uploadedUrl ?? "")
      const res = await fetch(`/api/driver/delivery/${deliveryId}/status`, {
        method: "POST",
        body: fd,
      })
      if (res.redirected && res.ok) {
        router.replace(new URL(res.url).pathname)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || "처리 중 오류가 발생했습니다.")
        setSubmitting(false)
        return
      }
      router.refresh()
      resetAndClose()
    } catch (err) {
      setError("네트워크 오류. 다시 시도해 주세요.")
      setSubmitting(false)
    }
  }

  const resetAndClose = () => {
    stopCamera()
    setCameraModalOpen(false)
    setCameraReady(false)
    setCameraError(null)
    setPermissionDenied(false)
    setPermissionRetrying(false)
    setCapturedPreview(null)
    setCapturedUploadedUrl(null)
    setCameraModalError(null)
    hasAutoOpenedHelp.current = false
    setOpen(false)
    setPreview(null)
    setUploadedUrl(null)
    setSubmitting(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const openCameraModal = () => {
    setCameraModalOpen(true)
    setCameraError(null)
    setPermissionDenied(false)
    startCamera(false)
  }

  const closeCameraModal = () => {
    stopCamera()
    setCameraModalOpen(false)
    setCameraReady(false)
    setCameraError(null)
    setPermissionDenied(false)
    setPermissionRetrying(false)
    setCapturedPreview(null)
    setCapturedUploadedUrl(null)
    setCameraModalError(null)
    hasAutoOpenedHelp.current = false
  }

  const handleCameraConfirm = async () => {
    if (!capturedUploadedUrl) return
    setPreview(capturedPreview)
    setUploadedUrl(capturedUploadedUrl)
    closeCameraModal()
    setSubmitting(true)
    setError(null)
    try {
      const form = formRef.current
      if (!form) return
      const fd = new FormData(form)
      fd.set("delivery_proof_url", capturedUploadedUrl)
      const res = await fetch(`/api/driver/delivery/${deliveryId}/status`, {
        method: "POST",
        body: fd,
      })
      if (res.redirected && res.ok) {
        router.replace(new URL(res.url).pathname)
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || "처리 중 오류가 발생했습니다.")
        setSubmitting(false)
        return
      }
      router.refresh()
      resetAndClose()
    } catch {
      setError("네트워크 오류. 다시 시도해 주세요.")
      setSubmitting(false)
    }
  }

  const inputId = `delivery-proof-input-${deliveryId}`
  const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : resetAndClose())}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} type="button">
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>배송 완료 인증</DialogTitle>
          <DialogDescription>
            인증 사진을 촬영하거나 선택하세요. (선택 사항)
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          action={`/api/driver/delivery/${deliveryId}/status`}
          method="POST"
        >
          <input type="hidden" name="status" value="delivered" />
          <input type="hidden" name="delivery_proof_url" value={uploadedUrl ?? ""} />
          {fromAccepted && <input type="hidden" name="from_accepted" value="1" />}
          <div className="space-y-4">
            {/* 촬영한 사진 미리보기: 모달에서 바로 확인 */}
            {preview && (
              <div className="relative rounded-lg border overflow-hidden bg-muted">
                <img
                  src={preview}
                  alt="배송 완료 인증"
                  className="w-full max-h-56 object-contain bg-black/5"
                />
                <p className="text-xs text-muted-foreground p-2 flex items-center gap-1 border-t">
                  <ImageIcon className="h-3 w-3" />
                  {uploadedUrl ? "업로드 완료 · 배송 완료 버튼을 누르면 제출됩니다" : "업로드 중…"}
                </p>
              </div>
            )}

            {!preview && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={openCameraModal}
                  disabled={loading}
                >
                  <Video className="h-4 w-4" />
                  카메라로 촬영
                </Button>
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                    loading && "pointer-events-none opacity-50",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={handleFileChange}
                    className="hidden"
                    id={inputId}
                    disabled={loading}
                  />
                  <ImageIcon className="h-4 w-4 shrink-0" />
                  갤러리에서 선택
                </label>
              </div>
            )}

            {preview && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setPreview(null)
                  setUploadedUrl(null)
                }}
              >
                사진 다시 선택
              </Button>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={loading || submitting}>
              취소
            </Button>
            <Button type="button" onClick={handleComplete} disabled={loading || submitting}>
              {submitting ? "완료 중…" : "배송 완료"}
            </Button>
          </DialogFooter>
        </form>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>

      {/* 카메라 촬영 전용 모달 (모바일 전체화면, 겹침 시 최상단) */}
      <Dialog open={cameraModalOpen} onOpenChange={(v) => !v && closeCameraModal()}>
        <DialogContent
          className={cn(
            "p-0 overflow-hidden gap-0 z-[100] flex flex-col",
            isMobile
              ? "inset-0 top-0 left-0 translate-x-0 translate-y-0 w-[100vw] h-[100dvh] max-w-[100vw] rounded-none"
              : "max-w-lg max-h-[90vh]"
          )}
        >
          <div className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-base">카메라로 촬영</DialogTitle>
            <DialogDescription className="text-sm">
              {capturedPreview ? "촬영한 사진을 확인하세요" : "배송된 물품이 보이도록 사각형 안에 맞춰 촬영하세요"}
            </DialogDescription>
          </div>
          <div className="relative bg-black min-h-[280px] flex-1 flex items-center justify-center overflow-hidden">
            {cameraError ? (
              <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                  <Video className="h-8 w-8 text-amber-600" />
                </div>
                <p className="text-sm text-slate-700">{cameraError}</p>
                {permissionDenied && (
                  <div className="flex flex-col gap-3 w-full max-w-xs">
                    <div className="text-left bg-slate-800/50 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-line">
                      <p className="font-medium text-slate-200 mb-1">카메라 권한 허용 방법</p>
                      {getCameraPermissionGuide().guide}
                    </div>
                    {!getCameraPermissionGuide().isInApp && getCameraPermissionGuide().helpUrl && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="gap-2 w-full"
                        onClick={() => {
                          const { helpUrl } = getCameraPermissionGuide()
                          if (helpUrl) window.open(helpUrl, "_blank", "noopener,noreferrer")
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                        설정·도움말 페이지 열기
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        startCamera(true)
                      }}
                      disabled={permissionRetrying}
                      className="gap-2 w-full"
                    >
                      {permissionRetrying ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                          권한 요청 중…
                        </>
                      ) : (
                        <>
                          <Video className="h-4 w-4" />
                          다시 권한 요청
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={closeCameraModal}
                    >
                      <ImageIcon className="h-4 w-4" />
                      취소하고 갤러리에서 선택
                    </Button>
                  </div>
                )}
              </div>
            ) : capturedPreview ? (
              <img
                src={capturedPreview}
                alt="촬영한 사진"
                className="w-full max-h-[70vh] sm:max-h-[60vh] object-contain"
              />
            ) : cameraReady && streamRef.current ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-[60vh] sm:max-h-[50vh] object-cover"
                />
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-hidden
                >
                  <div className="w-[88%] aspect-[4/3] border-2 border-white rounded-lg shadow-[0_0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/80 py-12">
                <div className="w-10 h-10 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                <p className="text-sm">카메라 준비 중…</p>
              </div>
            )}
          </div>
          {cameraModalError && (
            <p className="text-sm text-destructive px-4 pb-2">{cameraModalError}</p>
          )}
          <div className="flex gap-2 p-4 border-t bg-background shrink-0">
            {capturedPreview ? (
              <>
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setCapturedPreview(null); setCapturedUploadedUrl(null); startCamera(false) }}>
                  다시 촬영
                </Button>
                <Button type="button" className="flex-1 gap-2" onClick={handleCameraConfirm} disabled={submitting}>
                  {submitting ? "완료 중…" : "확인"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" className="flex-1" onClick={closeCameraModal}>
                  취소
                </Button>
                {cameraReady && !cameraError && (
                  <Button
                    type="button"
                    className="flex-1 gap-2"
                    onClick={handleCapture}
                    disabled={loading}
                  >
                    <Camera className="h-4 w-4" />
                    {loading ? "업로드 중…" : "촬영"}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
