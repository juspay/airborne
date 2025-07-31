"use client"

import { useState } from "react"
import useSWR from "swr"
import SharedLayout from "@/components/shared-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, MoreHorizontal, Edit, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileCreationModal } from "@/components/file-creation-modal"
import { useAppContext } from "@/providers/app-context"
import { apiFetch } from "@/lib/api"

type ApiFile = {
  id: string
  file_path: string
  url: string
  version: number
  tag: string
  size?: number
  status?: string
  created_at?: string
  metadata?: Record<string, any>
}

export default function FilesPage() {
  const { token, org, app } = useAppContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const { data, error, mutate, isLoading } = useSWR(
    token && org && app ? ["/file/list", searchQuery] : null,
    async () =>
      apiFetch<any>(
        "/file/list",
        { method: "GET", query: { search: searchQuery || undefined, page: 1, per_page: 50 } },
        { token, org, app },
      ),
  )

  const files: ApiFile[] = data?.files || []

  async function updateTag(f: ApiFile) {
    const currentKey = f.id || f.file_path
    const newTag = prompt(`Update tag for ${currentKey}`, f.tag || "")
    if (!newTag) return
    await apiFetch(
      `/file/${encodeURIComponent(currentKey)}`,
      { method: "PATCH", body: { tag: newTag } },
      { token, org, app },
    )
    mutate()
  }

  return (
    <SharedLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Files</h1>
            <p className="text-muted-foreground mt-2">Manage your application assets and resources</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            Create File
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search files by path, tag, or metadata..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
              Files {isLoading ? "" : `(${files.length})`}
            </CardTitle>
            <CardDescription>URL-registered files for your application</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {error && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-red-600">
                      Failed to load files
                    </TableCell>
                  </TableRow>
                )}
                {!error &&
                  files
                    .filter((f) => (filterType === "all" ? true : f.status === filterType))
                    .map((f) => (
                      <TableRow key={f.id || f.file_path}>
                        <TableCell className="font-mono text-sm">{f.file_path}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.tag}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{f.version}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-muted-foreground">{f.url}</TableCell>
                        <TableCell>
                          <Badge variant={f.status === "ready" ? "default" : "secondary"}>{f.status || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {f.created_at ? new Date(f.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateTag(f)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Update Tag
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <FileCreationModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} onCreated={() => mutate()} />
      </div>
    </SharedLayout>
  )
}
