"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppContext } from "@/providers/app-context"

export default function RootRedirect() {
  const { token } = useAppContext()
  const router = useRouter()

  useEffect(() => {
    if (token) router.replace("/dashboard")
    else router.replace("/login")
  }, [token, router])

  return null
}
