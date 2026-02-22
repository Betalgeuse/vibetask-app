"use client"

import type { ComponentProps } from "react"
import {
  HeroToastProvider,
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

type HeroToasterBridgeProps = ComponentProps<typeof HeroToastProvider>

// TODO(heroui-migration): replace legacy <Toaster /> usage with this provider + heroAddToast calls.
export function HeroToasterBridge(props: HeroToasterBridgeProps) {
  return <HeroToastProvider {...props} />
}
