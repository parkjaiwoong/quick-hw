"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { updateAnnouncement } from "@/lib/actions/announcements"
import type { Announcement } from "@/lib/actions/announcements"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type FormState = { status: "idle" | "success" | "error"; message?: string }
const initialState: FormState = { status: "idle" }

export function AnnouncementEditForm({
  announcement,
  onSuccess,
}: {
  announcement: Announcement
  onSuccess: () => void
}) {
  const [state, action] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await updateAnnouncement(announcement.id, formData)
      if (result.error) return { status: "error" as const, message: result.error }
      onSuccess()
      return { status: "success" as const }
    },
    initialState,
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-title">제목</Label>
        <Input id="edit-title" name="title" defaultValue={announcement.title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-content">내용</Label>
        <Textarea id="edit-content" name="content" defaultValue={announcement.content} rows={6} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-target_audience">대상</Label>
        <select
          id="edit-target_audience"
          name="target_audience"
          defaultValue={announcement.target_audience}
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
          id="edit-is_pinned"
          name="is_pinned"
          value="on"
          defaultChecked={announcement.is_pinned}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="edit-is_pinned" className="text-sm font-normal cursor-pointer">
          상단 고정
        </Label>
      </div>
      {state.status === "error" && <p className="text-sm text-destructive">{state.message}</p>}
      <EditSubmitButton />
    </form>
  )
}

function EditSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "저장 중..." : "수정 저장"}
    </Button>
  )
}
