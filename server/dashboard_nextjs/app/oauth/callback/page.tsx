"use client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useApp } from "@/providers/app-context"

export default function OAuthCallback() {
  const params = useSearchParams()
  const router = useRouter()
  const { setToken, setUser } = useApp()

  useEffect(() => {
    const code = params.get("code")
    const state = params.get("state") || undefined
    if (!code) return
    ;(async () => {
      try {
        const res = await apiFetch<{ user_id: string; user_token: any }>("/users/oauth/login", {
          method: "POST",
          body: { code, state },
        })
        setToken(res.user_token?.access_token || "")
        setUser({ user_id: res.user_id, name: "" }) // OAuth users will get name from API response
        router.push("/organisations")
      } catch (e: any) {
        // Error toast will be shown automatically by apiFetch
        router.push("/login")
      }
    })()
  }, [params, router, setToken, setUser])

  return <div className="p-6">Completing sign-in...</div>
}
