"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  Package,
  Rocket,
  Search,
  Settings,
  Bell,
  ChevronDown,
  ArrowLeft,
  Users,
  Calendar,
  TrendingUp,
  Eye,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import SharedLayout from "@/components/shared-layout"

export default function ApplicationDetailPage() {
  const params = useParams()
  const appId = params.appId as string

  const org = params.orgId as string

  const application = {
    id: appId,
    name: appId,
    description: "",
    platform: "",
    status: "active",
    createdAt: "2024-01-15",
    lastDeployment: "2024-01-28",
    totalReleases: 24,
    activeUsers: 125000,
    teamMembers: 8,
  }

  const releases = [
    {
      id: "1",
      name: "Holiday Features v2.1.4",
      version: "2.1.4",
      status: "deployed",
      createdAt: "2024-01-28",
      deployedAt: "2024-01-28",
      rolloutPercentage: 100,
      affectedUsers: 125000,
      packages: ["core-ui-components", "holiday-features"],
      createdBy: "Sarah Chen",
    },
    {
      id: "2",
      name: "Security Patch v2.1.3",
      version: "2.1.3",
      status: "deployed",
      createdAt: "2024-01-25",
      deployedAt: "2024-01-25",
      rolloutPercentage: 100,
      affectedUsers: 124500,
      packages: ["security-updates"],
      createdBy: "Mike Johnson",
    },
    {
      id: "3",
      name: "Beta Navigation v2.2.0",
      version: "2.2.0",
      status: "rolling_out",
      createdAt: "2024-01-29",
      deployedAt: "2024-01-29",
      rolloutPercentage: 25,
      affectedUsers: 31250,
      packages: ["experimental-nav", "analytics-sdk"],
      createdBy: "Alex Rodriguez",
    },
    {
      id: "4",
      name: "Performance Improvements v2.1.5",
      version: "2.1.5",
      status: "draft",
      createdAt: "2024-01-30",
      deployedAt: null,
      rolloutPercentage: 0,
      affectedUsers: 0,
      packages: ["core-ui-components", "performance-utils"],
      createdBy: "Sarah Chen",
    },
  ]

  // Mock team members
  const teamMembers = [
    { id: "1", name: "Sarah Chen", email: "sarah@company.com", role: "Admin", avatar: "SC" },
    { id: "2", name: "Mike Johnson", email: "mike@company.com", role: "Developer", avatar: "MJ" },
    { id: "3", name: "Alex Rodriguez", email: "alex@company.com", role: "Developer", avatar: "AR" },
    { id: "4", name: "Emily Watson", email: "emily@company.com", role: "QA", avatar: "EW" },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "deployed":
        return "bg-green-100 text-green-800"
      case "rolling_out":
        return "bg-blue-100 text-blue-800"
      case "draft":
        return "bg-gray-100 text-gray-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "deployed":
        return <CheckCircle className="h-4 w-4" />
      case "rolling_out":
        return <Play className="h-4 w-4" />
      case "draft":
        return <Clock className="h-4 w-4" />
      case "failed":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <SharedLayout>
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href={"/dashboard/" + org}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">{application.name}</h1>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {application.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">{application.description}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button asChild>
                <Link href={`/dashboard/${org}/${appId}/releases/create`}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Release
                </Link>
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="releases">Releases</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Releases</p>
                        <p className="text-2xl font-bold">{application.totalReleases}</p>
                      </div>
                      <Rocket className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                        <p className="text-2xl font-bold">{formatNumber(application.activeUsers)}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                        <p className="text-2xl font-bold">{application.teamMembers}</p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Last Deploy</p>
                        <p className="text-lg font-bold">{new Date(application.lastDeployment).toLocaleDateString()}</p>
                      </div>
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Releases */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Recent Releases</CardTitle>
                  <CardDescription>Latest deployments and their status</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Release</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Rollout</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {releases.slice(0, 5).map((release) => (
                        <TableRow key={release.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{release.name}</div>
                              <div className="text-sm text-muted-foreground">v{release.version}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(release.status)}
                              <Badge variant="secondary" className={getStatusColor(release.status)}>
                                {release.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${release.rolloutPercentage}%` }}
                                />
                              </div>
                              <span className="text-sm">{release.rolloutPercentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatNumber(release.affectedUsers)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(release.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {release.status === "rolling_out" && (
                                <Button variant="ghost" size="sm">
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {release.status === "deployed" && (
                                <Button variant="ghost" size="sm">
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="releases" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-[family-name:var(--font-space-grotesk)]">All Releases</CardTitle>
                      <CardDescription>Complete release history for this application</CardDescription>
                    </div>
                    <Button asChild>
                      <Link href={`/applications/${appId}/releases/create`}>
                        <Rocket className="h-4 w-4 mr-2" />
                        Create Release
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Release</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Rollout</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Packages</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {releases.map((release) => (
                        <TableRow key={release.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{release.name}</div>
                              <div className="text-sm text-muted-foreground">v{release.version}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(release.status)}
                              <Badge variant="secondary" className={getStatusColor(release.status)}>
                                {release.status.replace("_", " ")}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${release.rolloutPercentage}%` }}
                                />
                              </div>
                              <span className="text-sm">{release.rolloutPercentage}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatNumber(release.affectedUsers)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {release.packages.slice(0, 2).map((pkg) => (
                                <Badge key={pkg} variant="outline" className="text-xs">
                                  {pkg}
                                </Badge>
                              ))}
                              {release.packages.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{release.packages.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{release.createdBy}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(release.createdAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {release.status === "rolling_out" && (
                                <Button variant="ghost" size="sm">
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {release.status === "deployed" && (
                                <Button variant="ghost" size="sm">
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Team Members</CardTitle>
                      <CardDescription>People with access to this application</CardDescription>
                    </div>
                    <Button>
                      <Users className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                {member.avatar}
                              </div>
                              <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-muted-foreground">{member.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.role === "Admin" ? "default" : "secondary"}>{member.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">2 hours ago</span>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
                      Deployment Success Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 mb-2">98.5%</div>
                    <p className="text-sm text-muted-foreground">Last 30 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Average Rollout Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-2">2.3h</div>
                    <p className="text-sm text-muted-foreground">From 0% to 100%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">User Adoption</CardTitle>
                  <CardDescription>How quickly users adopt new releases</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    Analytics chart would go here
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
    </SharedLayout>
  )
}
