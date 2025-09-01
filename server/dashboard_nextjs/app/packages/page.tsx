"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LegacyPackagesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/packages")
  }, [router])
  return null
}
