"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { deleteAnnouncementById } from "@/lib/actions/announcements"
import type { Announcement } from "@/lib/actions/announcements"
import { Pencil, Trash2, Pin } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { AnnouncementEditForm } from "./announcement-edit-form"

export function AnnouncementList({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">등록된 공지사항이 없습니다</p>
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <AnnouncementRow key={a.id} announcement={a} />
      ))}
    </div>
  )
}

function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const onSuccess = useCallback(() => {
    setOpen(false)
    router.refresh()
  }, [router])

  return (
    <div className="list-item-card flex items-start justify-between gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {announcement.is_pinned && <Pin className="h-4 w-4 shrink-0 text-amber-500" />}
          <span className="font-medium">{announcement.title}</span>
          <span className="text-xs rounded px-1.5 py-0.5 bg-muted">
            {announcement.target_audience === "common" ? "공통" : announcement.target_audience === "customer" ? "고객용" : "기사용"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{announcement.content}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(announcement.created_at).toLocaleString("ko-KR")}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공지사항 수정</DialogTitle>
              <DialogDescription>내용을 수정한 뒤 저장합니다</DialogDescription>
            </DialogHeader>
            <AnnouncementEditForm announcement={announcement} onSuccess={onSuccess} />
          </DialogContent>
        </Dialog>
        <form
          action={async (fd) => {
            if (!confirm("정말 삭제하시겠습니까?")) return
            await deleteAnnouncementById(fd)
            router.refresh()
          }}
        >
          <input type="hidden" name="id" value={announcement.id} />
          <Button type="submit" variant="ghost" size="icon" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
