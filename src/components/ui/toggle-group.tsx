import * as React from 'react'
import * as T from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'
export const ToggleGroup = React.forwardRef<React.ElementRef<typeof T.Root>, React.ComponentPropsWithoutRef<typeof T.Root>>(({ className, ...p }, ref) => (
  <T.Root ref={ref} className={cn('inline-flex items-center rounded-lg bg-muted p-0.5', className)} {...p} />
))
ToggleGroup.displayName = 'ToggleGroup'
export const ToggleGroupItem = React.forwardRef<React.ElementRef<typeof T.Item>, React.ComponentPropsWithoutRef<typeof T.Item>>(({ className, ...p }, ref) => (
  <T.Item ref={ref} className={cn('inline-flex h-7 items-center justify-center rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm', className)} {...p} />
))
ToggleGroupItem.displayName = 'ToggleGroupItem'
