"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LegacyCreatePackageRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/dashboard/packages/create")
  }, [router])
  return null
}
