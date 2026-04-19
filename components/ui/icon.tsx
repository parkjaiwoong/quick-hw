import * as React from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Shadcn UI와 유사한 얇은 선형 Lucide 스트로크 (FontAwesome 대신 라인 아이콘 통일) */
export const LUCIDE_LINE_STROKE = 1.5

export type IconProps = LucideProps & {
  icon: LucideIcon
}

/**
 * Lucide 아이콘을 동일한 선 두께·접근성 속성으로 렌더링합니다.
 * @example <Icon icon={Package} className="size-4 text-muted-foreground" />
 */
export function Icon({
  icon: LucideComp,
  className,
  strokeWidth = LUCIDE_LINE_STROKE,
  'aria-hidden': ariaHidden = true,
  focusable = false,
  ...props
}: IconProps) {
  return (
    <LucideComp
      className={cn('shrink-0', className)}
      strokeWidth={strokeWidth}
      aria-hidden={ariaHidden}
      focusable={focusable}
      {...props}
    />
  )
}
