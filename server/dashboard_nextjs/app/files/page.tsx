"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LegacyFilesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/files")
  }, [router])
  return null
}
