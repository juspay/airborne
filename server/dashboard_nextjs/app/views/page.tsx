"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Activity,
  Package,
  Rocket,
  Search,
  Plus,
  Settings,
  Bell,
  ChevronDown,
  Globe,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Eye,
  Star,
  Calendar,
  User,
  Filter,
} from "lucide-react"
import Link from "next/link"

interface CustomView {
  id: string
  name: string
  description: string
  filters: {
    platform?: string
    region?: string
    version?: string
    userType?: string
  }
  createdAt: string
  createdBy: string
  isDefault: boolean
  usageCount: number
  lastUsed?: string
}

export default function ViewsPage() {
  const [selectedOrg, setSelectedOrg] = useState("Acme Corp")
  const [selectedApp, setSelectedApp] = useState("Mobile App")
  const [searchQuery, setSearchQuery] = useState("")

  // Mock data
  const [customViews, setCustomViews] = useState<CustomView[]>([
    {
      id: "default",
      name: "All Users",
      description: "Default view showing all users across all platforms and regions",
      filters: {},
      createdAt: "System",
      createdBy: "System",
      isDefault: true,
      usageCount: 245,
      lastUsed: "2 minutes ago",
    },
    {
      id: "mobile-only",
      name: "Mobile Users",
      description: "Focus on mobile app users (iOS and Android)",
      filters: { platform: "mobile" },
      createdAt: "1 week ago",
      createdBy: "Sarah Chen",
      isDefault: false,
      usageCount: 89,
      lastUsed: "1 hour ago",
    },
    {
      id: "premium-users",
      name: "Premium Users",
      description: "Premium subscribers across all platforms",
      filters: { userType: "premium" },
      createdAt: "2 weeks ago",
      createdBy: "Mike Johnson",
      isDefault: false,
      usageCount: 156,
      lastUsed: "3 hours ago",
    },
    {
      id: "us-region",
      name: "US Region",
      description: "Users in the United States market",
      filters: { region: "us" },
      createdAt: "3 weeks ago",
      createdBy: "Alex Rodriguez",
      isDefault: false,
      usageCount: 67,
      lastUsed: "1 day ago",
    },
    {
      id: "beta-testers",
      name: "Beta Testers",
      description: "Beta users testing new features on latest version",
      filters: { userType: "beta", version: "2.1.4" },
      createdAt: "1 month ago",
      createdBy: "Sarah Chen",
      isDefault: false,
      usageCount: 23,
      lastUsed: "2 days ago",
    },
  ])

  const filteredViews = customViews.filter(
    (view) =>
      view.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      view.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getFilterSummary = (filters: CustomView["filters"]) => {
    const filterEntries = Object.entries(filters).filter(([_, value]) => value !== undefined)
    if (filterEntries.length === 0) return "No filters"
    return filterEntries.map(([key, value]) => `${key}: ${value}`).join(", ")
  }

  const deleteView = (viewId: string) => {
    setCustomViews((views) => views.filter((view) => view.id !== viewId))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-16 items-center px-6">
          {/* Left: Logo and Scope Switcher */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Rocket className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg font-[family-name:var(--font-space-grotesk)]">Airborne</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Button variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                {selectedOrg} <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              <span className="text-muted-foreground">›</span>
              <Button variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                {selectedApp} <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files, packages, releases..."
                className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>

          {/* Right: Actions and User */}
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs">
              ADMIN
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Package className="mr-2 h-4 w-4" />
                  Upload Files
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Package className="mr-2 h-4 w-4" />
                  Create Package
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Rocket className="mr-2 h-4 w-4" />
                  New Release
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/views/create">
                    <Eye className="mr-2 h-4 w-4" />
                    Custom View
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-sidebar/50 backdrop-blur supports-[backdrop-filter]:bg-sidebar/50">
          <nav className="p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Application</div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/">
                <Activity className="h-4 w-4" />
                Overview
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/files">
                <Package className="h-4 w-4" />
                Files
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/packages">
                <Package className="h-4 w-4" />
                Packages
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/releases">
                <Rocket className="h-4 w-4" />
                Releases
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Globe className="h-4 w-4" />
              Resources
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Activity className="h-4 w-4" />
              Simulate
            </Button>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 mt-6">Views</div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <Eye className="h-4 w-4" />
              Custom Views
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
                Custom Views
              </h1>
              <p className="text-muted-foreground mt-2">Create and manage custom filtered views for your dashboard</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/views/create">
                <Plus className="h-4 w-4" />
                Create View
              </Link>
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{customViews.length}</div>
                <p className="text-xs text-muted-foreground">{customViews.filter((v) => !v.isDefault).length} custom</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Most Used</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {Math.max(...customViews.map((v) => v.usageCount))}
                </div>
                <p className="text-xs text-muted-foreground">times accessed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {customViews.reduce((sum, v) => sum + v.usageCount, 0)}
                </div>
                <p className="text-xs text-muted-foreground">across all views</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Filters</CardTitle>
                <Filter className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {customViews.reduce((sum, v) => sum + Object.keys(v.filters).length, 0)}
                </div>
                <p className="text-xs text-muted-foreground">total filter criteria</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search views by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Views Table */}
          <Card>
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
                Views ({filteredViews.length})
              </CardTitle>
              <CardDescription>All custom views and their filter configurations</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>View</TableHead>
                    <TableHead>Filters</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViews.map((view) => (
                    <TableRow key={view.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{view.name}</span>
                              {view.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">{view.description}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">{getFilterSummary(view.filters)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{view.usageCount} times</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {view.createdAt}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {view.createdBy}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{view.lastUsed || "Never"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href="/">
                                <Eye className="mr-2 h-4 w-4" />
                                Apply View
                              </Link>
                            </DropdownMenuItem>
                            {!view.isDefault && (
                              <>
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit View
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteView(view.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
