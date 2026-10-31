import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cn } from 'cn'

type SelectOption = {
  label: string
  value: string
}

type SelectProps = {
  value: string
  options: readonly SelectOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="select-chevron">
      <path d="m3.5 6 4.5 4 4.5-4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="select-check">
      <path d="m3.25 8.25 3 3 6.5-6.5" />
    </svg>
  )
}

function Select({ value, options, onValueChange, disabled, className, 'aria-label': ariaLabel }: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (typeof nextValue === 'string') onValueChange(nextValue)
      }}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        className={cn('ui-select-trigger', className)}
        aria-label={ariaLabel}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="ui-select-icon">
          <ChevronDownIcon />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} className="ui-select-positioner">
          <SelectPrimitive.Popup className="ui-select-popup">
            <SelectPrimitive.List className="ui-select-list">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="ui-select-item"
                  label={option.label}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ui-select-indicator">
                    <CheckIcon />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select, type SelectOption }
