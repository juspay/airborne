"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react"

function getVariantIcon(variant?: "default" | "destructive" | "success" | "warning" | "info" | null) {
  switch (variant) {
    case "success":
      return <CheckCircle className="h-5 w-5 shrink-0" />
    case "destructive":
      return <XCircle className="h-5 w-5 shrink-0" />
    case "warning":
      return <AlertTriangle className="h-5 w-5 shrink-0" />
    case "info":
      return <Info className="h-5 w-5 shrink-0" />
    default:
      return null
  }
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const icon = getVariantIcon(variant)
        
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3 flex-1">
              {icon}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
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
