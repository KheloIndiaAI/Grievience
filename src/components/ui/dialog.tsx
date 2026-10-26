import * as React from 'react'
import * as D from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close
export const DialogTitle = React.forwardRef<React.ElementRef<typeof D.Title>, React.ComponentPropsWithoutRef<typeof D.Title>>(({ className, ...p }, ref) => <D.Title ref={ref} className={cn('text-lg font-semibold tracking-tight', className)} {...p} />)
export const DialogDescription = React.forwardRef<React.ElementRef<typeof D.Description>, React.ComponentPropsWithoutRef<typeof D.Description>>(({ className, ...p }, ref) => <D.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...p} />)
const Overlay = React.forwardRef<React.ElementRef<typeof D.Overlay>, React.ComponentPropsWithoutRef<typeof D.Overlay>>((props, ref) => (
  <D.Overlay ref={ref} className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" {...props} />
))
Overlay.displayName = 'Overlay'
export const DialogContent = React.forwardRef<React.ElementRef<typeof D.Content>, React.ComponentPropsWithoutRef<typeof D.Content> & { hideClose?: boolean }>(
  ({ className, children, hideClose, ...props }, ref) => (
    <D.Portal>
      <Overlay />
      <D.Content ref={ref} className={cn('fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-card p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95', className)} {...props}>
        {children}
        {!hideClose && (
          <D.Close className="absolute right-4 top-4 rounded-md p-1 opacity-70 transition hover:bg-accent hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-4 w-4" /><span className="sr-only">Close</span>
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  ))
DialogContent.displayName = 'DialogContent'
export const SheetContent = React.forwardRef<React.ElementRef<typeof D.Content>, React.ComponentPropsWithoutRef<typeof D.Content> & { side?: 'left' | 'right' }>(
  ({ className, children, side = 'right', ...props }, ref) => (
    <D.Portal>
      <Overlay />
      <D.Content ref={ref} className={cn('fixed inset-y-0 z-50 flex h-full w-[min(420px,100vw)] flex-col border bg-card shadow-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out',
        side === 'right' ? 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right' : 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left', className)} {...props}>
        {children}
        <D.Close className="absolute right-4 top-4 rounded-md p-1 opacity-70 transition hover:bg-accent hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" /><span className="sr-only">Close</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  ))
SheetContent.displayName = 'SheetContent'
