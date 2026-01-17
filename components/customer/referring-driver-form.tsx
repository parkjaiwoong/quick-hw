"use client"

import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateReferringDriverWithState } from "@/lib/actions/customer"

type ReferringDriverFormProps = {
  initialReferringDriverId?: string | null
}

const initialState = { status: "idle" as const, message: "" }

export function ReferringDriverForm({ initialReferringDriverId }: ReferringDriverFormProps) {
  const [state, formAction, isPending] = useActionState(updateReferringDriverWithState, initialState)

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="referringDriverId">추천 기사 ID</Label>
        <Input
          id="referringDriverId"
          name="referringDriverId"
          type="text"
          defaultValue={initialReferringDriverId || ""}
          placeholder="추천 기사 UUID 입력 (없으면 비움)"
        />
        <p className="text-xs text-muted-foreground">변경 후 저장하면 추천 기사 ID가 업데이트됩니다.</p>
      </div>

      {state.status !== "idle" && (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "저장 중..." : "추천 기사 ID 저장"}
      </Button>
    </form>
  )
}
