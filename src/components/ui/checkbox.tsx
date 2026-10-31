import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { cn } from 'cn'
import type { ComponentProps } from 'react'

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="checkbox-check-icon">
      <path d="m3.25 8.25 3 3 6.5-6.5" />
    </svg>
  )
}

type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root>

function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root data-slot="checkbox" className={cn('ui-checkbox', className)} {...props}>
      <CheckboxPrimitive.Indicator className="ui-checkbox-indicator">
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
