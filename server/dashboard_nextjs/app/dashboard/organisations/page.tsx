"use client"
import useSWR, { mutate } from "swr"
import SharedLayout from "@/components/shared-layout"
import { apiFetch } from "@/lib/api"
import { useApp } from "@/providers/app-context"

type ApplicationRef = { application: string; organisation: string; access: string[] }
type Organisation = { name: string; applications: ApplicationRef[]; access: string[] }

export default function OrganisationsPage() {
  const { data, error, isLoading } = useSWR<Organisation[]>("/organisations", (url) => apiFetch(url))
  const { setOrg, setApp, org } = useApp()

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete organisation ${name}?`)) return
    await apiFetch(`/organisations/${encodeURIComponent(name)}`, { method: "DELETE" })
    mutate("/organisations")
  }

  return (
    <SharedLayout title="Organisations">
      {isLoading ? (
        <div>Loading...</div>
      ) : error ? (
        <div>Error loading organisations</div>
      ) : (
        <div className="space-y-4">
          {data?.map((org) => (
            <div key={org.name} className="border rounded p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{org.name}</div>
                <div className="text-sm text-muted-foreground">{org.applications?.length || 0} applications</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="border rounded px-3 py-1"
                  onClick={() => {
                    setOrg(org.name)
                    setApp("")
                  }}
                >
                  Select
                </button>
                <button className="border rounded px-3 py-1" onClick={() => handleDelete(org.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SharedLayout>
  )
}
