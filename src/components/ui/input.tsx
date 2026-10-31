import { cn } from 'cn'
import { forwardRef, type ComponentProps } from 'react'

const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(({ className, ...props }, ref) => (
  <input ref={ref} data-slot="input" className={cn('ui-input', className)} {...props} />
))

Input.displayName = 'Input'

export { Input }
