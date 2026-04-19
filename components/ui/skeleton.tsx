import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'bg-muted/70 animate-pulse rounded-lg ring-1 ring-border/25 ring-inset',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
