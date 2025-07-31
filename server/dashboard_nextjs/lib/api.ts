import { LS_TOKEN, useAppContext } from "@/providers/app-context"
import { toastError } from "@/hooks/use-toast"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""

type FetchOptions = {
  method?: string
  headers?: Record<string, string>
  body?: any
  requireAuth?: boolean
  query?: Record<string, string | number | undefined>
  showErrorToast?: boolean // New option to control error toast display
}

export async function apiFetch<T>(
  path: string,
  opts: FetchOptions = {},
  ctx?: { token?: string | null; org?: string | null; app?: string | null; logout?: () => void },
): Promise<T> {
  const showErrorToast = opts.showErrorToast !== false // Default to true unless explicitly set to false
  path = `/api/${path}`
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

  try {
    const res = await fetch(path.toString(), {
      method: opts.method || "GET",
      headers,
      credentials: "include",
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })

    // Handle different HTTP status codes
    if ((res.status === 401 || res.status === 403) && !path.includes("login")) {
      // Handle unauthorized access
      console.error("Unauthorized access - redirecting to login")
      localStorage.clear()
      if (ctx?.logout) ctx.logout()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
      const error = new Error("Unauthorized access")
      if (showErrorToast) {
        toastError("Authentication Failed", "Please log in again")
      }
      throw error
    }

    const contentType = res.headers.get("content-type")
    let responseData: any

    if (contentType && contentType.includes("application/json")) {
      responseData = await res.json()
    } else {
      responseData = await res.text()
    }

    // Handle non-2xx status codes
    if (!res.ok) {
      const errorMessage = responseData?.message || responseData?.error || `HTTP ${res.status}: ${res.statusText}`
      const error = new Error(errorMessage)
      
      if (showErrorToast) {
        toastError("Request Failed", errorMessage)
      }
      
      //throw error
    }

    return responseData
  } catch (err) {
    // Handle network errors and other exceptions
    const error = err as Error
    console.error("API Error:", error)
    
    if (showErrorToast && error.message !== "Unauthorized access") {
      // Don't show toast for auth errors since we handle them above
      toastError("Network Error", error.message || "An unexpected error occurred")
    }
    
    //throw error
    return Promise.resolve() as Promise<T>
  }
}

// Convenience hooks
export function useApiContext() {
  // allows consumers to get bound helpers without re-passing headers
  const { token, org, app } = useAppContext() as any
  return { token, org, app }
}
