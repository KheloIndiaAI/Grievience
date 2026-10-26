import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
const badgeVariants = cva('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary text-primary-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'text-foreground',
      good: 'border-transparent bg-[color-mix(in_srgb,var(--status-good)_14%,transparent)] text-[var(--good-ink)]',
      warning: 'border-transparent bg-[color-mix(in_srgb,var(--status-warning)_22%,transparent)] text-[var(--warning-ink)]',
      critical: 'border-transparent bg-[color-mix(in_srgb,var(--status-critical)_13%,transparent)] text-[var(--critical-ink)]',
      info: 'border-transparent bg-accent text-accent-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <span className={cn(badgeVariants({ variant }), className)} {...props} /> }
