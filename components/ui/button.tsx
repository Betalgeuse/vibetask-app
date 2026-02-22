"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { button as heroButton } from "@heroui/theme"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

const heroVariantMap: Record<
  ButtonVariant,
  {
    color: "default" | "primary" | "danger"
    variant: "solid" | "bordered" | "flat" | "light"
  }
> = {
  default: { color: "primary", variant: "solid" },
  destructive: { color: "danger", variant: "solid" },
  outline: { color: "default", variant: "bordered" },
  secondary: { color: "default", variant: "flat" },
  ghost: { color: "default", variant: "light" },
  link: { color: "primary", variant: "light" },
}

const heroSizeMap: Record<ButtonSize, "sm" | "md" | "lg"> = {
  default: "md",
  sm: "sm",
  lg: "lg",
  icon: "md",
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const normalizedVariant = variant ?? "default"
    const normalizedSize = size ?? "default"

    if (asChild) {
      return (
        <Slot
          className={cn(
            buttonVariants({
              variant: normalizedVariant,
              size: normalizedSize,
              className,
            })
          )}
          ref={ref}
          {...props}
        />
      )
    }

    const heroVariant = heroVariantMap[normalizedVariant]
    const heroClasses = heroButton({
      color: heroVariant.color,
      variant: heroVariant.variant,
      size: heroSizeMap[normalizedSize],
      radius: "sm",
      isIconOnly: normalizedSize === "icon",
      fullWidth: false,
    })

    return (
      <button
        ref={ref}
        className={cn(
          heroClasses,
          buttonVariants({
            variant: normalizedVariant,
            size: normalizedSize,
          }),
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
