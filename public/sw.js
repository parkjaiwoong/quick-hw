/* Service Worker: Web Push 알림 (탭 종료 후에도 배송 요청 알림 수신) */
self.addEventListener("push", function (event) {
  if (!event.data) return
  let data = { title: "새 배송 요청", body: "배송 요청이 도착했습니다.", url: "/driver" }
  try {
    const parsed = event.data.json()
    if (parsed.title) data.title = parsed.title
    if (parsed.body) data.body = parsed.body
    if (parsed.url) data.url = parsed.url
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.svg",
      tag: "delivery-request",
      requireInteraction: true,
      data: { url: data.url },
    })
  )
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  const url = event.notification.data?.url || "/driver"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      const fullUrl = new URL(url, self.location.origin).href
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(fullUrl)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(fullUrl)
    })
  )
})
