"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { deleteCustomerBillingKey } from "@/lib/actions/billing"

export function BillingKeyDeleteForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm("등록된 카드를 해제할까요?")) return
    setLoading(true)
    try {
      const res = await deleteCustomerBillingKey(userId)
      if (res?.error) {
        alert(res.error)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="mr-1 h-4 w-4" />
      {loading ? "해제 중…" : "카드 연동 해제"}
    </Button>
  )
}
