"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LegacyCreateReleaseRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/releases/create")
  }, [router])
  return null
}
