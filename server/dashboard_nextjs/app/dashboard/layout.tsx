"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/providers/app-context"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    console.log("Dashboard Page Token:", token)
    if (!token) router.replace("/login")
  }, [token, router])

  if (!token) return null
  return <>{children}</>
}
