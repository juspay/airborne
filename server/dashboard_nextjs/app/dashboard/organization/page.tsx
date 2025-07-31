"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Users,
  Building2,
  TrendingUp,
  Activity,
  Plus,
  Settings,
  MoreHorizontal,
  Crown,
  Shield,
  UserPlus,
  Globe,
  Rocket,
  Package,
  FileText,
  ChevronRight,
  BarChart3,
  Zap,
} from "lucide-react"
import Link from "next/link"
import SharedLayout from "@/components/shared-layout"

interface Application {
  id: string
  name: string
  platform: string
  status: "active" | "inactive" | "development"
  users: number
  releases: number
  lastDeployment: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "developer" | "viewer"
  avatar?: string
  lastActive: string
  status: "active" | "invited" | "inactive"
}

export default function OrganizationDashboard() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isCreateAppModalOpen, setIsCreateAppModalOpen] = useState(false)

  // Mock data
  const orgStats = {
    totalApps: 12,
    totalUsers: 45892,
    totalReleases: 156,
    activeMembers: 8,
  }

  const applications: Application[] = [
    {
      id: "1",
      name: "Mobile App",
      platform: "React Native",
      status: "active",
      users: 24891,
      releases: 45,
      lastDeployment: "2 hours ago",
    },
    {
      id: "2",
      name: "Web Dashboard",
      platform: "Next.js",
      status: "active",
      users: 12456,
      releases: 32,
      lastDeployment: "1 day ago",
    },
    {
      id: "3",
      name: "Admin Portal",
      platform: "React",
      status: "development",
      users: 234,
      releases: 8,
      lastDeployment: "3 days ago",
    },
    {
      id: "4",
      name: "Marketing Site",
      platform: "Next.js",
      status: "active",
      users: 8311,
      releases: 71,
      lastDeployment: "5 hours ago",
    },
  ]

  const teamMembers: TeamMember[] = [
    {
      id: "1",
      name: "Sarah Chen",
      email: "sarah@acmecorp.com",
      role: "owner",
      avatar: "/diverse-woman-portrait.png",
      lastActive: "Online now",
      status: "active",
    },
    {
      id: "2",
      name: "Mike Johnson",
      email: "mike@acmecorp.com",
      role: "admin",
      avatar: "/thoughtful-man.png",
      lastActive: "2 hours ago",
      status: "active",
    },
    {
      id: "3",
      name: "Alex Rodriguez",
      email: "alex@acmecorp.com",
      role: "developer",
      avatar: "/diverse-group.png",
      lastActive: "1 day ago",
      status: "active",
    },
    {
      id: "4",
      name: "Emma Wilson",
      email: "emma@acmecorp.com",
      role: "developer",
      lastActive: "3 days ago",
      status: "active",
    },
    {
      id: "5",
      name: "David Kim",
      email: "david@acmecorp.com",
      role: "viewer",
      lastActive: "Pending",
      status: "invited",
    },
  ]

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-yellow-500" />
      case "admin":
        return <Shield className="h-4 w-4 text-blue-500" />
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary/10 text-primary border-primary/20"
      case "development":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "inactive":
        return "bg-muted text-muted-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <SharedLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
              Organization Overview
            </h1>
            <p className="text-muted-foreground mt-2">Manage your organization, applications, and team members</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsInviteModalOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
            <Button onClick={() => setIsCreateAppModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Application
            </Button>
          </div>
        </div>

        {/* Organization Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Applications</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{orgStats.totalApps}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +2 this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{orgStats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +15% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Releases</CardTitle>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{orgStats.totalReleases}</div>
              <p className="text-xs text-muted-foreground">
                <Activity className="inline h-3 w-3 mr-1" />
                12 this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{orgStats.activeMembers}</div>
              <p className="text-xs text-muted-foreground">1 pending invitation</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Applications */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Applications</CardTitle>
                <CardDescription>All applications in your organization</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/applications">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {applications.slice(0, 4).map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{app.name}</h4>
                      <p className="text-sm text-muted-foreground">{app.platform}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <div className="font-medium">{app.users.toLocaleString()} users</div>
                      <div className="text-muted-foreground">{app.releases} releases</div>
                    </div>
                    <Badge variant="secondary" className={getStatusColor(app.status)}>
                      {app.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/applications/${app.id}`}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            View Dashboard
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Zap className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Team Members</CardTitle>
                <CardDescription>People with access to your organization</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/users">
                  Manage
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamMembers.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        {getRoleIcon(member.role)}
                      </div>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={
                        member.status === "active" ? "default" : member.status === "invited" ? "secondary" : "outline"
                      }
                      className={member.status === "active" ? "bg-primary/10 text-primary border-primary/20" : ""}
                    >
                      {member.role}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{member.lastActive}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Recent Activity</CardTitle>
            <CardDescription>Latest events across all applications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  action: "New release deployed",
                  details: "Mobile App v2.1.4 - Holiday Features",
                  app: "Mobile App",
                  time: "2 hours ago",
                  user: "Sarah Chen",
                  icon: <Rocket className="h-4 w-4 text-primary" />,
                },
                {
                  action: "Team member invited",
                  details: "David Kim invited as Viewer",
                  app: "Organization",
                  time: "4 hours ago",
                  user: "Mike Johnson",
                  icon: <UserPlus className="h-4 w-4 text-blue-500" />,
                },
                {
                  action: "Package created",
                  details: "holiday-ui-components",
                  app: "Web Dashboard",
                  time: "6 hours ago",
                  user: "Alex Rodriguez",
                  icon: <Package className="h-4 w-4 text-green-500" />,
                },
                {
                  action: "Application created",
                  details: "Admin Portal initialized",
                  app: "Organization",
                  time: "1 day ago",
                  user: "Sarah Chen",
                  icon: <Globe className="h-4 w-4 text-purple-500" />,
                },
                {
                  action: "Files uploaded",
                  details: "24 new assets added",
                  app: "Marketing Site",
                  time: "2 days ago",
                  user: "Emma Wilson",
                  icon: <FileText className="h-4 w-4 text-orange-500" />,
                },
              ].map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5">{activity.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-sm text-muted-foreground">{activity.details}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {activity.app}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {activity.time} • {activity.user}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Invite Member Modal */}
        <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-space-grotesk)]">Invite Team Member</DialogTitle>
              <DialogDescription>Send an invitation to join your organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="colleague@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="developer">Developer - Can create and deploy</option>
                  <option value="admin">Admin - Full access except billing</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Personal Message (optional)</Label>
                <Textarea id="message" placeholder="Welcome to the team!" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsInviteModalOpen(false)}>Send Invitation</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Application Modal */}
        <Dialog open={isCreateAppModalOpen} onOpenChange={setIsCreateAppModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-space-grotesk)]">Create New Application</DialogTitle>
              <DialogDescription>Set up a new application for OTA deployments</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">Application Name</Label>
                <Input id="appName" placeholder="My Awesome App" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="react-native">React Native</option>
                  <option value="nextjs">Next.js</option>
                  <option value="react">React</option>
                  <option value="vue">Vue.js</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" placeholder="Brief description of your application..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateAppModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsCreateAppModalOpen(false)}>Create Application</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SharedLayout>
  )
}
