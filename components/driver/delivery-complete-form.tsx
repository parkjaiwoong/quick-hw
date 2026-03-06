"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { updateDeliveryStatus, uploadDeliveryProof } from "@/lib/actions/driver"
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
import { Camera, Image as ImageIcon } from "lucide-react"

interface DeliveryCompleteFormProps {
  deliveryId: string
  label?: string
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
}

export function DeliveryCompleteForm({
  deliveryId,
  label = "배송 완료",
  variant = "default",
  size = "lg",
  className,
}: DeliveryCompleteFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const result = await uploadDeliveryProof(deliveryId, formData)
      if (result.error) {
        setError(result.error)
        setPreview(null)
        setLoading(false)
        return
      }
      setUploadedUrl(result.url)
    } catch {
      setError("업로드에 실패했습니다.")
      setPreview(null)
    } finally {
      setLoading(false)
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleComplete = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await updateDeliveryStatus(
        deliveryId,
        "delivered",
        uploadedUrl ?? undefined
      )
      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }
      setOpen(false)
      setPreview(null)
      setUploadedUrl(null)
      router.refresh()
    } catch {
      setError("처리 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const resetAndClose = () => {
    setOpen(false)
    setPreview(null)
    setUploadedUrl(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

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
            사진을 촬영하면 자동으로 업로드됩니다. (선택 사항)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={handleFileChange}
            className="sr-only"
            id="delivery-proof-input"
            disabled={loading}
            tabIndex={-1}
          />
          <label
            htmlFor="delivery-proof-input"
            className={cn(
              "flex items-center justify-center gap-2 w-full rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
              loading && "pointer-events-none opacity-50",
            )}
          >
            <Camera className="h-4 w-4" />
            {loading ? "업로드 중…" : "사진 촬영 (촬영 시 자동 업로드)"}
          </label>
          {preview && (
            <div className="relative rounded-lg border overflow-hidden bg-muted">
              <img
                src={preview}
                alt="배송 완료 인증"
                className="w-full max-h-48 object-contain"
              />
              <p className="text-xs text-muted-foreground p-2 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {uploadedUrl ? "업로드 완료" : "업로드 중…"}
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetAndClose} disabled={loading}>
            취소
          </Button>
          <Button onClick={handleComplete} disabled={loading}>
            {loading ? "처리 중…" : "배송 완료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
