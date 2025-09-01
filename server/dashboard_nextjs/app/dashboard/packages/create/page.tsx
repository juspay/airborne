"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import SharedLayout from "@/components/shared-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, ArrowLeft, FileText, Rocket } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/lib/api"
import { useAppContext } from "@/providers/app-context"

type ApiFile = { id?: string; file_path: string; url: string; version: number; tag?: string; size?: number }

export default function CreatePackagePage() {
  const { token, org, app } = useAppContext()
  const [packageName, setPackageName] = useState("")
  const [version, setVersion] = useState("1.0.0")
  const [description, setDescription] = useState("")
  const [tag, setTag] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data, error, isLoading } = useSWR<ApiFile[]>(
    token && org && app ? ["/file/list", searchQuery] : null,
    async () =>
      apiFetch(
        "/file/list",
        { method: "GET", query: { search: searchQuery || undefined, page: 1, per_page: 200 } },
        { token, org, app },
      ).then((res) => res.files || []),
  )

  const files = data || []

  const toggle = (f: ApiFile) => {
    const key = f.id || `${f.file_path}@${f.version}`
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectedList = useMemo(() => {
    return files.filter((f) => {
      const key = f.id || `${f.file_path}@${f.version}`
      return selected[key]
    })
  }, [files, selected])

  async function onCreate(submitAsDraft?: boolean) {
    setIsSubmitting(true)
    try {
      const fileIds = selectedList.map((f) => f.id || f.file_path)
      await apiFetch(
        "/packages",
        {
          method: "POST",
          body: {
            index: packageName,
            version,
            tag: tag || undefined,
            description: description || undefined,
            files: fileIds,
          },
        },
        { token, org, app },
      )
      window.location.href = "/dashboard/packages"
    } catch (e: any) {
      alert(e.message || "Failed to create package")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SharedLayout>
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/packages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
              Create Package
            </h1>
            <p className="text-muted-foreground mt-2">Bundle files together with properties and metadata</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Package Details</CardTitle>
              <CardDescription>Basic information about your package</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., core-ui-components"
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  placeholder="e.g., 1.0.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                <Input id="tag" placeholder="e.g., latest" value={tag} onChange={(e) => setTag(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of what this package contains..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Selected Files Summary */}
              {selectedList.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({selectedList.length})</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {selectedList.map((f) => {
                      const key = f.id || `${f.file_path}@${f.version}`
                      return (
                        <div key={key} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-mono">{f.file_path}</span>
                            <span className="text-muted-foreground">(v{f.version})</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => toggle(f)}>
                            Remove
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Files</CardTitle>
              <CardDescription>Choose files to include in this package</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {error ? (
                <div className="text-red-600">Failed to load files</div>
              ) : isLoading ? (
                <div>Loading…</div>
              ) : files.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No files found. Create a file first from the Create menu or the Files page.
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Tag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((f) => {
                        const key = f.id || `${f.file_path}@${f.version}`
                        return (
                          <TableRow key={key}>
                            <TableCell>
                              <Checkbox checked={!!selected[key]} onCheckedChange={() => toggle(f)} />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{f.file_path}</TableCell>
                            <TableCell className="text-muted-foreground">{f.version}</TableCell>
                            <TableCell className="text-muted-foreground">{f.tag || "—"}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button variant="outline" asChild>
            <Link href="/dashboard/packages">Cancel</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onCreate(true)} disabled={isSubmitting}>
              Save as Draft
            </Button>
            <Button
              onClick={() => onCreate()}
              disabled={!packageName || !version || selectedList.length === 0 || isSubmitting}
              className="gap-2"
            >
              <Rocket className="h-4 w-4" />
              Create Package
            </Button>
          </div>
        </div>
      </div>
    </SharedLayout>
  )
}
