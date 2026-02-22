"use client"

import * as React from "react"
import type { CheckedState } from "@radix-ui/react-checkbox"
import { Checkbox as HeroCheckbox } from "@heroui/react"

import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof HeroCheckbox>,
    "checked" | "defaultChecked" | "isSelected" | "defaultSelected" | "isIndeterminate" | "onValueChange"
  > {
  checked?: CheckedState
  defaultChecked?: CheckedState
  onCheckedChange?: (checked: CheckedState) => void
  onValueChange?: (value: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onValueChange, children, ...props }, ref) => {
    const isControlled = checked !== undefined
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState<CheckedState>(
      defaultChecked ?? false
    )

    const resolvedChecked = isControlled ? checked ?? false : uncontrolledChecked
    const isChecked = resolvedChecked === true
    const isIndeterminate = resolvedChecked === "indeterminate"

    const handleValueChange = (nextValue: boolean) => {
      const nextChecked: CheckedState = nextValue

      if (!isControlled) {
        setUncontrolledChecked(nextChecked)
      }

      onValueChange?.(nextValue)
      onCheckedChange?.(nextChecked)
    }

    return (
      <HeroCheckbox
        ref={ref}
        isSelected={isChecked}
        isIndeterminate={isIndeterminate}
        defaultSelected={!isControlled ? defaultChecked === true : undefined}
        onValueChange={handleValueChange}
        data-state={
          isIndeterminate ? "indeterminate" : isChecked ? "checked" : "unchecked"
        }
        classNames={{
          base: cn(
            "peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary bg-transparent text-transparent ring-offset-background transition-colors data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[focus-visible=true]:outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-ring data-[focus-visible=true]:ring-offset-2 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
            className
          ),
          wrapper:
            "m-0 h-full w-full rounded-[inherit] border-none bg-inherit text-inherit before:hidden after:hidden",
          icon: "h-4 w-4 text-current",
          ...(children ? {} : { label: "sr-only" }),
        }}
        {...props}
      >
        {children}
      </HeroCheckbox>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
