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
import { Camera, Image as ImageIcon, Video } from "lucide-react"

interface DeliveryCompleteFormProps {
  deliveryId: string
  label?: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

async function uploadBlob(deliveryId: string, blob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append("file", blob, "capture.jpg")
  const res = await fetch(`/api/driver/delivery/${deliveryId}/upload-proof`, {
    method: "POST",
    body: formData,
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
}: DeliveryCompleteFormProps) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [cameraActive, setCameraActive] = useState(false)
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
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch (e) {
      setError("카메라에 접근할 수 없습니다. 갤러리에서 사진을 선택해 주세요.")
    }
  }, [])

  useEffect(() => {
    if (!cameraActive || !streamRef.current) return
    const video = videoRef.current
    if (video) video.srcObject = streamRef.current
    return () => {
      if (video?.srcObject) video.srcObject = null
    }
  }, [cameraActive])

  const handleCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video || !video.srcObject || video.readyState < 2) return
    setLoading(true)
    setError(null)
    try {
      const canvas = canvasRef.current || document.createElement("canvas")
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas not available")
      ctx.drawImage(video, 0, 0)
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setError("촬영 실패")
            setLoading(false)
            return
          }
          try {
            const url = await uploadBlob(deliveryId, blob)
            const dataUrl = URL.createObjectURL(blob)
            setPreview(dataUrl)
            setUploadedUrl(url)
            stopCamera()
          } catch (err) {
            setError(err instanceof Error ? err.message : "업로드에 실패했습니다.")
          } finally {
            setLoading(false)
          }
        },
        "image/jpeg",
        0.9
      )
    } catch {
      setError("촬영에 실패했습니다.")
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
    setOpen(false)
    setPreview(null)
    setUploadedUrl(null)
    setSubmitting(false)
    setError(null)
    setCameraActive(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const inputId = `delivery-proof-input-${deliveryId}`

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
              <>
                {/* 전용 카메라 촬영: 앱 내 카메라 영상 + 촬영 버튼 */}
                {!cameraActive ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-center gap-2"
                      onClick={startCamera}
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
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                        id={inputId}
                        disabled={loading}
                      />
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      갤러리에서 선택
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 촬영 영역: 사각형 프레임이 있는 카메라 뷰 */}
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {/* 촬영 사각형 프레임 (뷰파인더) */}
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        aria-hidden
                      >
                        <div className="w-[88%] aspect-[4/3] border-2 border-white rounded-lg shadow-[0_0_0_0_9999px_rgba(0,0,0,0.35)]" />
                      </div>
                    </div>
                    {/* 촬영 방법 안내 */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 space-y-1">
                      <p className="font-medium text-slate-700">📷 촬영 방법</p>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                        <li>화면 안 사각형 안에 배송된 물품이 보이도록 맞춰 주세요</li>
                        <li>아래 &quot;촬영&quot; 버튼을 눌러 사진을 저장합니다</li>
                        <li>흔들리지 않도록 장치를 고정한 뒤 촬영해 주세요</li>
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={stopCamera}>
                        취소
                      </Button>
                      <Button
                        type="button"
                        className="flex-1 gap-2"
                        onClick={handleCapture}
                        disabled={loading}
                      >
                        <Camera className="h-4 w-4" />
                        {loading ? "업로드 중…" : "촬영"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
    </Dialog>
  )
}
