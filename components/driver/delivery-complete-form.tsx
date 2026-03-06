"use client"

import { useState, useRef } from "react"
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
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

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

  const handleComplete = (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return
    const form = formRef.current
    if (!form) return
    const urlInput = form.querySelector<HTMLInputElement>('input[name="delivery_proof_url"]')
    if (urlInput) urlInput.value = uploadedUrl ?? ""
    form.submit()
  }

  const resetAndClose = () => {
    setOpen(false)
    setPreview(null)
    setUploadedUrl(null)
    setError(null)
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
            사진을 촬영하면 자동으로 업로드됩니다. (선택 사항)
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
              <Camera className="h-4 w-4 shrink-0" />
              <span>{loading ? "업로드 중…" : "사진 촬영 (촬영 시 자동 업로드)"}</span>
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
            <Button type="button" onClick={handleComplete} disabled={loading}>
              {loading ? "처리 중…" : "배송 완료"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
