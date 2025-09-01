import { useAppContext } from "@/providers/app-context"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""

type FetchOptions = {
  method?: string
  headers?: Record<string, string>
  body?: any
  requireAuth?: boolean
  query?: Record<string, string | number | undefined>
}

export async function apiFetch(
  path: string,
  opts: FetchOptions = {},
  ctx?: { token?: string | null; org?: string | null; app?: string | null },
) {
  const url = new URL(
    (API_BASE || "") + path,
    typeof window === "undefined" ? "http://localhost" : window.location.origin,
  )
  if (opts.query) {
    Object.entries(opts.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  }

  const token = ctx?.token
  const org = ctx?.org
  const app = ctx?.app

  if (opts.requireAuth !== false && token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (org) headers["x-organisation"] = org
  if (app) headers["x-application"] = app

  const res = await fetch(url.href, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }
  const ct = res.headers.get("content-type")
  if (ct && ct.includes("application/json")) return res.json()
  return res.text()
}

// Convenience hooks
export function useApiContext() {
  // allows consumers to get bound helpers without re-passing headers
  const { token, org, app } = useAppContext() as any
  return { token, org, app }
}
