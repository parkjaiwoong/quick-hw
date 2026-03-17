/** 지연 배송 목록에 over_minutes, customer, driver 붙이기 (순수 JS, SWC 파서 회피) */
function mins(d) {
  return d.expected_delivery_minutes != null ? d.expected_delivery_minutes : d.urgency === "express" ? 30 : 180
}

export function enrichLateDeliveries(late, profileMap) {
  const result = []
  for (let i = 0; i < late.length; i++) {
    const d = late[i]
    const accepted = new Date(d.accepted_at).getTime()
    const delivered = new Date(d.delivered_at).getTime()
    const expectedBy = accepted + mins(d) * 60 * 1000
    const overMin = Math.round((delivered - expectedBy) / 60000)
    const customer = d.customer_id ? (profileMap.get(d.customer_id) ?? null) : null
    const driver = d.driver_id ? (profileMap.get(d.driver_id) ?? null) : null
    result.push(Object.assign({}, d, { over_minutes: overMin, customer, driver }))
  }
  return result
}
