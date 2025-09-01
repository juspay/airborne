"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Activity,
  Package,
  Rocket,
  Search,
  Settings,
  Bell,
  ChevronDown,
  Globe,
  ArrowLeft,
  Eye,
  X,
  Filter,
  Users,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"

interface ViewFilters {
  platform?: string
  region?: string
  version?: string
  userType?: string
}

export default function CreateViewPage() {
  const [selectedOrg, setSelectedOrg] = useState("Acme Corp")
  const [selectedApp, setSelectedApp] = useState("Mobile App")
  const [viewName, setViewName] = useState("")
  const [description, setDescription] = useState("")
  const [filters, setFilters] = useState<ViewFilters>({})

  const updateFilter = (key: keyof ViewFilters, value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }))
  }

  const removeFilter = (key: keyof ViewFilters) => {
    setFilters((prev) => {
      const newFilters = { ...prev }
      delete newFilters[key]
      return newFilters
    })
  }

  const hasFilters = Object.values(filters).some((value) => value !== undefined)

  const handleCreateView = () => {
    console.log("Creating view:", {
      viewName,
      description,
      filters,
    })
    // Handle view creation logic here
  }

  // Mock preview data based on filters
  const getPreviewData = () => {
    let baseUsers = 24891
    const baseReleases = 3
    let baseErrorRate = 0.12

    // Simulate filter effects
    if (filters.platform === "mobile") {
      baseUsers = Math.floor(baseUsers * 0.7)
    } else if (filters.platform === "web") {
      baseUsers = Math.floor(baseUsers * 0.3)
    }

    if (filters.userType === "premium") {
      baseUsers = Math.floor(baseUsers * 0.25)
      baseErrorRate = baseErrorRate * 0.8
    } else if (filters.userType === "beta") {
      baseUsers = Math.floor(baseUsers * 0.05)
      baseErrorRate = baseErrorRate * 1.5
    }

    if (filters.region === "us") {
      baseUsers = Math.floor(baseUsers * 0.4)
    } else if (filters.region === "eu") {
      baseUsers = Math.floor(baseUsers * 0.3)
    }

    return {
      users: baseUsers,
      releases: baseReleases,
      errorRate: Number(baseErrorRate.toFixed(2)),
    }
  }

  const previewData = getPreviewData()

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
              asChild
            >
              <Link href="/views">
                <Eye className="h-4 w-4" />
                Custom Views
              </Link>
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/views">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
                Create Custom View
              </h1>
              <p className="text-muted-foreground mt-2">Create a filtered view for your dashboard</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* View Configuration */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">View Details</CardTitle>
                  <CardDescription>Basic information about your custom view</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">View Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Mobile Premium Users"
                      value={viewName}
                      onChange={(e) => setViewName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of what this view shows..."
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Filter Configuration</CardTitle>
                  <CardDescription>Set up filters to customize your view</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select
                        value={filters.platform || "all"}
                        onValueChange={(value) => updateFilter("platform", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Platforms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Platforms</SelectItem>
                          <SelectItem value="mobile">Mobile</SelectItem>
                          <SelectItem value="web">Web</SelectItem>
                          <SelectItem value="ios">iOS</SelectItem>
                          <SelectItem value="android">Android</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Select value={filters.region || "all"} onValueChange={(value) => updateFilter("region", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Regions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Regions</SelectItem>
                          <SelectItem value="us">United States</SelectItem>
                          <SelectItem value="eu">Europe</SelectItem>
                          <SelectItem value="asia">Asia Pacific</SelectItem>
                          <SelectItem value="latam">Latin America</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>App Version</Label>
                      <Select
                        value={filters.version || "all"}
                        onValueChange={(value) => updateFilter("version", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Versions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Versions</SelectItem>
                          <SelectItem value="2.1.4">v2.1.4</SelectItem>
                          <SelectItem value="2.1.3">v2.1.3</SelectItem>
                          <SelectItem value="2.1.2">v2.1.2</SelectItem>
                          <SelectItem value="2.0.x">v2.0.x</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>User Type</Label>
                      <Select
                        value={filters.userType || "all"}
                        onValueChange={(value) => updateFilter("userType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="beta">Beta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Active Filters Display */}
                  {hasFilters && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Active Filters</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(filters).map(
                          ([key, value]) =>
                            value && (
                              <Badge key={key} variant="secondary" className="gap-1">
                                {key}: {value}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 hover:bg-transparent"
                                  onClick={() => removeFilter(key as keyof ViewFilters)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ),
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Preview</CardTitle>
                  <CardDescription>See how your view will look with current data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-primary">{previewData.users.toLocaleString()}</div>
                          <p className="text-xs text-muted-foreground">
                            <TrendingUp className="inline h-3 w-3 mr-1" />
                            +12% from last week
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Live Releases</CardTitle>
                          <Rocket className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-primary">{previewData.releases}</div>
                          <p className="text-xs text-muted-foreground">2 staged, 1 full rollout</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-destructive">{previewData.errorRate}%</div>
                          <p className="text-xs text-muted-foreground">-0.03% from yesterday</p>
                        </CardContent>
                      </Card>
                    </div>

                    {!hasFilters && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Eye className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm">Add filters to see a customized preview</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button variant="outline" asChild>
              <Link href="/views">Cancel</Link>
            </Button>
            <Button onClick={handleCreateView} disabled={!viewName}>
              Create View
            </Button>
          </div>
        </main>
      </div>
    </div>
  )
}
