"use client"

import { useMemo, useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download } from "lucide-react"
import QRCode from "qrcode"

type RiderReferralLinkProps = {
  riderCode: string | null
}

const QR_SIZE = 220

export function RiderReferralLink({ riderCode }: RiderReferralLinkProps) {
  const [copied, setCopied] = useState(false)
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setBaseUrl(typeof window !== "undefined" ? window.location.origin : null)
  }, [])

  const referralUrl = useMemo(() => {
    if (!riderCode) return ""
    const origin = baseUrl ?? "https://quick-hw.vercel.app"
    return `${origin}/r/${riderCode}`
  }, [riderCode, baseUrl])

  useEffect(() => {
    if (!referralUrl || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, referralUrl, {
      width: QR_SIZE,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch((err) => {
      console.error("QR 생성 실패:", err)
    })
  }, [referralUrl])

  const handleCopy = async () => {
    if (!referralUrl) return
    try {
      await navigator.clipboard.writeText(referralUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const handleDownload = () => {
    if (!canvasRef.current || !riderCode) return
    const link = document.createElement("a")
    link.download = `qr-소개링크-${riderCode}.png`
    link.href = canvasRef.current.toDataURL("image/png")
    link.click()
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>소개 링크 · QR 코드</CardTitle>
        <CardDescription>내 기사 코드로 고객을 소개할 수 있습니다. 링크를 복사하거나 QR 코드를 다운로드해 사용하세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          기사 코드: <span className="font-medium text-foreground">{riderCode || "미등록"}</span>
        </div>

        {referralUrl && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">QR 코드</p>
            <canvas
              ref={canvasRef}
              width={QR_SIZE}
              height={QR_SIZE}
              className="rounded border bg-white"
              aria-label="소개 링크 QR 코드"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              QR 코드 다운로드
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input readOnly value={referralUrl} placeholder="소개 링크가 없습니다." />
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={handleCopy}
            disabled={!referralUrl}
          >
            {copied ? "복사 완료" : "링크 복사"}
          </Button>
        </div>
        {copied && (
          <div className="text-xs text-green-600">클립보드에 복사되었습니다.</div>
        )}
      </CardContent>
    </Card>
  )
}
