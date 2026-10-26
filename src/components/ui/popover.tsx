import * as React from 'react'
import * as P from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'
export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverAnchor = P.Anchor
export const PopoverContent = React.forwardRef<React.ElementRef<typeof P.Content>, React.ComponentPropsWithoutRef<typeof P.Content>>(
  ({ className, align = 'start', sideOffset = 6, ...props }, ref) => (
    <P.Portal>
      <P.Content ref={ref} align={align} sideOffset={sideOffset}
        className={cn('z-50 rounded-lg border bg-popover p-0 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95', className)} {...props} />
    </P.Portal>
  ))
PopoverContent.displayName = 'PopoverContent'
