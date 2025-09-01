"use client"
import useSWR from "swr"
import { useParams } from "next/navigation"
import SharedLayout from "@/components/shared-layout"
import { apiFetch } from "@/lib/api"
export default function ReleaseDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const { data, error, isLoading, mutate } = useSWR<any>(id ? `/releases/${encodeURIComponent(id)}` : null, (url) =>
    apiFetch(url, {}, true),
  )

  const ramp = async () => {
    const pct = prompt("Traffic percentage (0-100)", "50")
    if (!pct) return
    await apiFetch(
      `/releases/${encodeURIComponent(id)}/ramp`,
      { method: "POST", body: { traffic_percentage: Number.parseInt(pct) } },
      true,
    )
    mutate()
  }
  const conclude = async () => {
    const variant = prompt("Winning variant id", "")
    if (!variant) return
    await apiFetch(
      `/releases/${encodeURIComponent(id)}/conclude`,
      { method: "POST", body: { chosen_variant: variant } },
      true,
    )
    mutate()
  }

  return (
    <SharedLayout title={`Release ${id}`}>
      {isLoading ? (
        <div>Loading...</div>
      ) : error ? (
        <div>Error</div>
      ) : (
        <div className="space-y-4">
          <pre className="bg-muted p-4 rounded overflow-auto text-xs">{JSON.stringify(data, null, 2)}</pre>
          <div className="flex gap-2">
            <button className="border rounded px-3 py-2" onClick={ramp}>
              Ramp
            </button>
            <button className="border rounded px-3 py-2" onClick={conclude}>
              Conclude
            </button>
          </div>
        </div>
      )}
    </SharedLayout>
  )
}
