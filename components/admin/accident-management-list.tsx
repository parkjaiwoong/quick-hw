"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, Shield, CheckCircle } from "lucide-react"
import { useState } from "react"
import { updateAccidentStatus } from "@/lib/actions/accident"

interface Accident {
  id: string
  delivery_id: string | null
  reporter_id: string | null
  driver_id: string | null
  accident_type: string
  accident_date: string
  accident_description: string
  package_damage_description: string | null
  status: string
  compensation_amount: number | null
  created_at: string
}

interface AccidentManagementListProps {
  accidents: Accident[]
}

export function AccidentManagementList({ accidents }: AccidentManagementListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleStatusChange(accidentId: string, newStatus: string) {
    setLoadingId(accidentId)
    const result = await updateAccidentStatus(accidentId, newStatus)
    if (result.error) {
      alert(result.error)
    } else {
      window.location.reload()
    }
    setLoadingId(null)
  }

  if (accidents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">접수된 사고가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {accidents.map((accident) => (
        <Card key={accident.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  사고 접수 #{accident.id.slice(0, 8)}
                </CardTitle>
                <CardDescription>
                  {new Date(accident.created_at).toLocaleString("ko-KR")}
                </CardDescription>
              </div>
              <Badge
                variant={
                  accident.status === "reported"
                    ? "secondary"
                    : accident.status === "investigating"
                    ? "default"
                    : accident.status === "resolved"
                    ? "default"
                    : "outline"
                }
              >
                {accident.status === "reported"
                  ? "접수"
                  : accident.status === "investigating"
                  ? "조사중"
                  : accident.status === "resolved"
                  ? "해결"
                  : "종료"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">사고 유형</p>
                <p className="text-sm text-muted-foreground">
                  {accident.accident_type === "damage" ? "물품 파손" : "물품 분실"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">사고 일시</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(accident.accident_date).toLocaleString("ko-KR")}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">사고 설명</p>
              <p className="text-sm text-muted-foreground">{accident.accident_description}</p>
            </div>

            {accident.package_damage_description && (
              <div>
                <p className="text-sm font-medium">파손 상세</p>
                <p className="text-sm text-muted-foreground">{accident.package_damage_description}</p>
              </div>
            )}

            {accident.compensation_amount && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <Shield className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">보상 금액</p>
                  <p className="text-lg font-bold text-green-900">
                    {accident.compensation_amount.toLocaleString()}원
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Select
                value={accident.status}
                onValueChange={(value) => handleStatusChange(accident.id, value)}
                disabled={loadingId === accident.id}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reported">접수</SelectItem>
                  <SelectItem value="investigating">조사중</SelectItem>
                  <SelectItem value="resolved">해결</SelectItem>
                  <SelectItem value="closed">종료</SelectItem>
                </SelectContent>
              </Select>
              {loadingId === accident.id && (
                <span className="text-sm text-muted-foreground">처리 중...</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

