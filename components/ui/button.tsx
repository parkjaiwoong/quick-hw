import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold leading-snug select-none transform-gpu transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-[220ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform active:scale-[0.96] active:duration-100 active:ease-out disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive motion-reduce:transition-[colors,opacity] motion-reduce:duration-150 motion-reduce:active:scale-100 motion-reduce:active:duration-150",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[var(--shadow-xs)] hover:bg-primary/92 hover:shadow-[var(--shadow-sm)]',
        destructive:
          'bg-destructive text-white shadow-[var(--shadow-xs)] hover:bg-destructive/90 hover:shadow-[var(--shadow-sm)] focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-border/80 bg-background shadow-[var(--shadow-xs)] hover:border-border hover:bg-accent hover:text-accent-foreground hover:shadow-[var(--shadow-sm)] dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[var(--shadow-xs)] hover:bg-secondary/90 hover:shadow-[var(--shadow-sm)]',
        ghost:
          'shadow-none hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline rounded-md shadow-none active:scale-100 transition-colors duration-150',
      },
      size: {
        default: 'h-11 px-6 py-2.5 has-[>svg]:px-5',
        sm: 'h-10 rounded-lg gap-1.5 px-4 has-[>svg]:px-3',
        lg: 'h-12 rounded-2xl px-8 text-base has-[>svg]:px-6',
        icon: 'size-11 rounded-xl',
        'icon-sm': 'size-9 rounded-lg',
        'icon-lg': 'size-11 rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
