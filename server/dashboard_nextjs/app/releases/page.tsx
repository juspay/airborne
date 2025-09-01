"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LegacyReleasesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/releases")
  }, [router])
  return null
}
