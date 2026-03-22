"use client"

/** 사고 접수 시 업로드된 증빙 사진 목록 표시 */
export function AccidentPhotos({ photos }: { photos: string[] | string | null | undefined }) {
  const urls: string[] = (() => {
    if (!photos) return []
    if (Array.isArray(photos)) return photos.filter((u) => typeof u === "string" && u)
    if (typeof photos === "string") {
      try {
        const parsed = JSON.parse(photos)
        return Array.isArray(parsed) ? parsed.filter((u: unknown) => typeof u === "string" && u) : []
      } catch {
        return photos.startsWith("http") ? [photos] : []
      }
    }
    return []
  })()

  if (urls.length === 0) return null

  return (
    <div className="space-y-2 mt-3">
      <p className="text-sm font-medium">증빙 사진</p>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img
              src={url}
              alt={`증빙 사진 ${i + 1}`}
              className="h-20 w-20 object-cover rounded-lg border hover:opacity-90 transition-opacity"
            />
          </a>
        ))}
      </div>
    </div>
  )
}
