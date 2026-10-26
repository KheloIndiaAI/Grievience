import * as React from 'react'
import * as S from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
export const Select = S.Root
export const SelectValue = S.Value
export const SelectTrigger = React.forwardRef<React.ElementRef<typeof S.Trigger>, React.ComponentPropsWithoutRef<typeof S.Trigger>>(({ className, children, ...p }, ref) => (
  <S.Trigger ref={ref} className={cn('flex h-8 items-center justify-between gap-2 rounded-md border border-input bg-card px-2.5 text-xs shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...p}>
    {children}<S.Icon asChild><ChevronDown className="h-3.5 w-3.5 opacity-60" /></S.Icon>
  </S.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'
export const SelectContent = React.forwardRef<React.ElementRef<typeof S.Content>, React.ComponentPropsWithoutRef<typeof S.Content>>(({ className, children, position = 'popper', ...p }, ref) => (
  <S.Portal><S.Content ref={ref} position={position} sideOffset={4} className={cn('z-50 min-w-[8rem] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95', className)} {...p}>
    <S.Viewport className="p-1">{children}</S.Viewport>
  </S.Content></S.Portal>
))
SelectContent.displayName = 'SelectContent'
export const SelectItem = React.forwardRef<React.ElementRef<typeof S.Item>, React.ComponentPropsWithoutRef<typeof S.Item>>(({ className, children, ...p }, ref) => (
  <S.Item ref={ref} className={cn('relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-2 pr-7 text-xs outline-none focus:bg-accent focus:text-accent-foreground', className)} {...p}>
    <S.ItemText>{children}</S.ItemText>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"><S.ItemIndicator><Check className="h-3.5 w-3.5" /></S.ItemIndicator></span>
  </S.Item>
))
SelectItem.displayName = 'SelectItem'
