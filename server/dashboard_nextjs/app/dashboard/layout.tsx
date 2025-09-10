"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/providers/app-context"
import SharedLayout from "@/components/shared-layout"

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, token } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    if (!token && !loading) router.replace("/login")
  }, [token, loading])

  if (!token) return null
  return <SharedLayout>
    <div className="bg-background">
      {children}
    </div>
  </SharedLayout>
}
