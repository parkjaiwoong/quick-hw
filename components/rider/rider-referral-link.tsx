"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type RiderReferralLinkProps = {
  riderCode: string | null
}

export function RiderReferralLink({ riderCode }: RiderReferralLinkProps) {
  const [copied, setCopied] = useState(false)
  const referralUrl = useMemo(() => {
    if (!riderCode) return ""
    return `https://quick-hw.vercel.app/r/${riderCode}`
  }, [riderCode])

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>소개 링크 복사</CardTitle>
        <CardDescription>내 기사 코드로 고객을 소개할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          기사 코드: <span className="font-medium text-foreground">{riderCode || "미등록"}</span>
        </div>
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
        {copied && <div className="text-xs text-green-600">클립보드에 복사되었습니다.</div>}
      </CardContent>
    </Card>
  )
}
