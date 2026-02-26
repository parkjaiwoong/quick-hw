/**
 * 전체 주소를 기사가 빠르게 인지할 수 있는 약자로 변환.
 * 예: 광명시 철산3동 → 철산3, 용산구 서빙고동 → 용산서빙고, 양평동2가 → 양평2
 */
export function toAddressAbbrev(addr: string): string {
  if (!addr || typeof addr !== "string") return "-"
  const s = addr.trim().replace(/\s+/g, " ")
  if (!s) return "-"

  // 구 추출 (서울 XX구)
  const guMatch = s.match(/([가-힣]+)구\b/)
  const gu = guMatch ? guMatch[1] : ""

  // 시 추출 (경기 XX시, 광명시)
  const siMatch = s.match(/([가-힣]+)시\b/)
  const si = siMatch ? siMatch[1] : ""

  // 동 추출 (철산3동, 서빙고동, 양평동2가, 돈암2동)
  const dong3Match = s.match(/([가-힣]+)([0-9一二三四五六七八九十])?동\b/)
  const dong2Match = s.match(/([가-힣]+)동\s*([0-9一二三四五六七八九十])?가\b/)
  const dongRoMatch = s.match(/([가-힣]+)(?:로|동)\b/)

  const hanToNum: Record<string, string> = {
    일: "1", 이: "2", 삼: "3", 사: "4", 오: "5",
    육: "6", 칠: "7", 팔: "8", 구: "9", 십: "10",
  }

  let dong = ""
  let suffix = ""

  if (dong3Match) {
    const [, name, num] = dong3Match
    dong = name
    suffix = num ? (hanToNum[num] ?? num) : ""
  } else if (dong2Match) {
    const [, name, num] = dong2Match
    dong = name
    suffix = num ? (hanToNum[num] ?? num) : ""
  } else if (dongRoMatch) {
    dong = dongRoMatch[1]
  }

  const abbrev = dong + suffix

  // 시+동 (광명철산3) 또는 구+동 (용산서빙고, 성북돈암2)
  if (gu && abbrev) {
    const combined = gu + abbrev
    if (combined.length <= 10) return combined
  }
  if (si && abbrev && abbrev !== si) {
    const combined = si + abbrev
    if (combined.length <= 10) return combined
  }

  // 동이 알려진 약자면 동만 반환 (능곡, 서강, 양평2)
  const knownDong = ["능곡", "서강", "양평2", "양평", "철산3", "철산", "마곡"]
  if (abbrev && knownDong.includes(abbrev)) return abbrev

  if (abbrev) return abbrev
  if (gu) return gu
  if (si) return si

  return s.length > 8 ? s.slice(0, 8) : s
}
