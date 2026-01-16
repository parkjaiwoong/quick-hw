"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface Notification {
  id: string
  user_id: string
  delivery_id: string | null
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [supabase, setSupabase] = useState<any>(null)

  useEffect(() => {
    if (!userId) return

    async function initNotifications() {
      try {
        const supabaseClient = createClient()
        setSupabase(supabaseClient)

        const { data } = await supabaseClient
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50)

        if (data) {
          setNotifications(data)
          setUnreadCount(data.filter((n) => !n.is_read).length)
        }

        const channel = supabaseClient
          .channel(`notifications:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            (payload) => {
              if (payload.eventType === "INSERT") {
                setNotifications((prev) => [payload.new as Notification, ...prev])
                setUnreadCount((prev) => prev + 1)
              } else if (payload.eventType === "UPDATE") {
                setNotifications((prev) =>
                  prev.map((n) => (n.id === payload.new.id ? (payload.new as Notification) : n)),
                )
                if ((payload.new as Notification).is_read) {
                  setUnreadCount((prev) => Math.max(0, prev - 1))
                }
              }
            },
          )
          .subscribe()

        return () => {
          supabaseClient.removeChannel(channel)
        }
      } catch (error) {
        console.error("[v0] Notifications initialization error:", error)
      }
    }

    initNotifications()
  }, [userId])

  async function markAsRead(notificationId: string) {
    if (!supabase) return
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId)
    } catch (error) {
      console.error("[v0] Error marking notification as read:", error)
    }
  }

  async function markAllAsRead() {
    if (!userId || !supabase) return

    try {
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false)
      setUnreadCount(0)
    } catch (error) {
      console.error("[v0] Error marking all notifications as read:", error)
    }
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }
}
