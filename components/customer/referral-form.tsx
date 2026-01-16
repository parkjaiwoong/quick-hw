"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerReferral } from "@/lib/actions/points"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function ReferralForm() {
  const [referralCode, setReferralCode] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!referralCode.trim()) {
      toast.error("추천인 코드를 입력해주세요")
      return
    }

    setLoading(true)
    const result = await registerReferral(referralCode.trim().toUpperCase())

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("추천인이 등록되었습니다")
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="referralCode">추천인 코드</Label>
        <Input
          id="referralCode"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          placeholder="추천인 코드를 입력하세요"
          disabled={loading}
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={loading || !referralCode.trim()} className="w-full">
        {loading ? "등록 중..." : "추천인 등록"}
      </Button>
    </form>
  )
}

