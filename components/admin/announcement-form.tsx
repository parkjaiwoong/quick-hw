"use client"

import { useActionState, useEffect } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { createAnnouncement } from "@/lib/actions/announcements"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type FormState = { status: "idle" | "success" | "error"; message?: string }
const initialState: FormState = { status: "idle" }

async function formAction(_prev: FormState, formData: FormData) {
  const result = await createAnnouncement(formData)
  if (result.error) return { status: "error" as const, message: result.error }
  return { status: "success" as const, message: "등록되었습니다" }
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "저장 중..." : "공지 등록"}
    </Button>
  )
}

export function AnnouncementForm() {
  const router = useRouter()
  const [state, action] = useActionState(formAction, initialState)

  useEffect(() => {
    if (state.status === "success") {
      router.refresh()
    }
  }, [state.status, router])

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">제목</Label>
        <Input id="title" name="title" placeholder="공지사항 제목" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">내용</Label>
        <Textarea id="content" name="content" placeholder="공지 내용" rows={6} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="target_audience">대상</Label>
        <select
          id="target_audience"
          name="target_audience"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="common">공통 (고객+기사)</option>
          <option value="customer">고객용</option>
          <option value="driver">기사용</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_pinned"
          name="is_pinned"
          value="on"
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="is_pinned" className="text-sm font-normal cursor-pointer">
          상단 고정
        </Label>
      </div>
      {state.status === "success" && <p className="text-sm text-green-600">{state.message}</p>}
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <SubmitButton />
    </form>
  )
}
