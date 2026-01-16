"use client"

import { CheckCircle, Circle, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"

interface DeliveryStatusTimelineProps {
  delivery: any
}

const statusSteps = [
  { key: "requested_at", label: "배송 요청", status: "pending" },
  { key: "accepted_at", label: "배송원 수락", status: "accepted" },
  { key: "picked_up_at", label: "픽업 완료", status: "picked_up" },
  { key: "delivered_at", label: "배송 완료", status: "delivered" },
]

export function DeliveryStatusTimeline({ delivery }: DeliveryStatusTimelineProps) {
  const currentStatusIndex = statusSteps.findIndex((step) => step.status === delivery.status)

  return (
    <div className="space-y-4">
      {statusSteps.map((step, index) => {
        const timestamp = delivery[step.key]
        const isCompleted = index <= currentStatusIndex
        const isCurrent = index === currentStatusIndex
        const isUpcoming = index > currentStatusIndex

        return (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle className="h-8 w-8 text-green-600 fill-green-100" />
              ) : isCurrent ? (
                <Clock className="h-8 w-8 text-blue-600" />
              ) : (
                <Circle className="h-8 w-8 text-gray-300" />
              )}
              {index < statusSteps.length - 1 && (
                <div className={`w-0.5 h-12 ${isCompleted ? "bg-green-600" : "bg-gray-300"}`} />
              )}
            </div>

            <div className="flex-1 pb-8">
              <p className={`font-semibold ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </p>
              {timestamp && (
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ko })}
                </p>
              )}
              {isCurrent && !timestamp && <p className="text-sm text-blue-600">진행 중...</p>}
            </div>
          </div>
        )
      })}

      {delivery.status === "cancelled" && (
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <Circle className="h-8 w-8 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-600">배송 취소됨</p>
            {delivery.cancelled_at && (
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(delivery.cancelled_at), { addSuffix: true, locale: ko })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
