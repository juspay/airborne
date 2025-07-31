"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Activity,
  Package,
  Rocket,
  Search,
  Settings,
  Bell,
  ChevronDown,
  Users,
  Edit,
  Trash2,
  Mail,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  Key,
} from "lucide-react"
import Link from "next/link"

interface User {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "developer" | "viewer"
  status: "active" | "pending" | "suspended"
  lastActive: string
  createdAt: string
  applications: string[]
  permissions: string[]
}

interface Invitation {
  id: string
  email: string
  role: string
  invitedBy: string
  createdAt: string
  expiresAt: string
  status: "pending" | "expired"
}

export default function UsersPage() {
  const [selectedOrg, setSelectedOrg] = useState("Acme Corp")
  const [searchQuery, setSearchQuery] = useState("")
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Form state for inviting users
  const [inviteData, setInviteData] = useState({
    email: "",
    role: "",
    applications: [] as string[],
  })

  // Mock users data
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "Sarah Chen",
      email: "sarah@company.com",
      role: "owner",
      status: "active",
      lastActive: "2024-01-30",
      createdAt: "2024-01-01",
      applications: ["Mobile Banking App", "Customer Portal"],
      permissions: ["all"],
    },
    {
      id: "2",
      name: "Mike Johnson",
      email: "mike@company.com",
      role: "admin",
      status: "active",
      lastActive: "2024-01-29",
      createdAt: "2024-01-05",
      applications: ["Mobile Banking App", "Admin Dashboard"],
      permissions: ["deploy", "manage_users", "view_analytics"],
    },
    {
      id: "3",
      name: "Alex Rodriguez",
      email: "alex@company.com",
      role: "developer",
      status: "active",
      lastActive: "2024-01-30",
      createdAt: "2024-01-10",
      applications: ["Mobile Banking App"],
      permissions: ["deploy", "view_analytics"],
    },
    {
      id: "4",
      name: "Emily Watson",
      email: "emily@company.com",
      role: "developer",
      status: "active",
      lastActive: "2024-01-28",
      createdAt: "2024-01-15",
      applications: ["Customer Portal", "Admin Dashboard"],
      permissions: ["deploy"],
    },
    {
      id: "5",
      name: "David Kim",
      email: "david@company.com",
      role: "viewer",
      status: "suspended",
      lastActive: "2024-01-20",
      createdAt: "2024-01-12",
      applications: ["Mobile Banking App"],
      permissions: ["view_analytics"],
    },
  ])

  // Mock invitations data
  const [invitations, setInvitations] = useState<Invitation[]>([
    {
      id: "1",
      email: "john@company.com",
      role: "developer",
      invitedBy: "Sarah Chen",
      createdAt: "2024-01-28",
      expiresAt: "2024-02-04",
      status: "pending",
    },
    {
      id: "2",
      email: "lisa@company.com",
      role: "viewer",
      invitedBy: "Mike Johnson",
      createdAt: "2024-01-25",
      expiresAt: "2024-02-01",
      status: "expired",
    },
  ])

  const roles = [
    { value: "owner", label: "Owner", description: "Full access to everything" },
    { value: "admin", label: "Admin", description: "Manage users and applications" },
    { value: "developer", label: "Developer", description: "Deploy releases and view analytics" },
    { value: "viewer", label: "Viewer", description: "Read-only access" },
  ]

  const applications = ["Mobile Banking App", "Customer Portal", "Admin Dashboard"]

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleInviteUser = () => {
    const newInvitation: Invitation = {
      id: Date.now().toString(),
      email: inviteData.email,
      role: inviteData.role,
      invitedBy: "Sarah Chen",
      createdAt: new Date().toISOString().split("T")[0],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: "pending",
    }

    setInvitations([...invitations, newInvitation])
    setInviteData({ email: "", role: "", applications: [] })
    setIsInviteModalOpen(false)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
  }

  const handleUpdateUser = (userId: string, updates: Partial<User>) => {
    setUsers(users.map((user) => (user.id === userId ? { ...user, ...updates } : user)))
    setEditingUser(null)
  }

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId))
  }

  const handleToggleUserStatus = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              status: user.status === "active" ? "suspended" : "active",
            }
          : user,
      ),
    )
  }

  const handleResendInvitation = (invitationId: string) => {
    setInvitations(
      invitations.map((inv) =>
        inv.id === invitationId
          ? {
              ...inv,
              status: "pending",
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            }
          : inv,
      ),
    )
  }

  const handleCancelInvitation = (invitationId: string) => {
    setInvitations(invitations.filter((inv) => inv.id !== invitationId))
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800"
      case "admin":
        return "bg-blue-100 text-blue-800"
      case "developer":
        return "bg-green-100 text-green-800"
      case "viewer":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "suspended":
        return "bg-red-100 text-red-800"
      case "expired":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />
      case "pending":
        return <Clock className="h-4 w-4" />
      case "suspended":
      case "expired":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-16 items-center px-6">
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
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>

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
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Organization</div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/organization">
                <Activity className="h-4 w-4" />
                Overview
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/applications">
                <Package className="h-4 w-4" />
                Applications
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <Users className="h-4 w-4" />
              Users & Access
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              asChild
            >
              <Link href="/dimensions">
                <Settings className="h-4 w-4" />
                Dimensions
              </Link>
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
                Users & Access
              </h1>
              <p className="text-muted-foreground mt-2">Manage team members and their permissions</p>
            </div>

            <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>Send an invitation to join your organization</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@company.com"
                        value={inviteData.email}
                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={inviteData.role}
                      onValueChange={(value) => setInviteData({ ...inviteData, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            <div>
                              <div className="font-medium">{role.label}</div>
                              <div className="text-xs text-muted-foreground">{role.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Applications (optional)</Label>
                    <div className="space-y-2">
                      {applications.map((app) => (
                        <div key={app} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={app}
                            checked={inviteData.applications.includes(app)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setInviteData({
                                  ...inviteData,
                                  applications: [...inviteData.applications, app],
                                })
                              } else {
                                setInviteData({
                                  ...inviteData,
                                  applications: inviteData.applications.filter((a) => a !== app),
                                })
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={app} className="text-sm font-normal">
                            {app}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsInviteModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteUser} disabled={!inviteData.email || !inviteData.role}>
                      Send Invitation
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold">{users.filter((u) => u.status === "active").length}</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Invites</p>
                    <p className="text-2xl font-bold">{invitations.filter((i) => i.status === "pending").length}</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Admins</p>
                    <p className="text-2xl font-bold">
                      {users.filter((u) => u.role === "admin" || u.role === "owner").length}
                    </p>
                  </div>
                  <Shield className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="invitations">Invitations</TabsTrigger>
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Team Members</CardTitle>
                  <CardDescription>Manage users and their access levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applications</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </div>
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getRoleColor(user.role)}>
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(user.status)}
                              <Badge variant="secondary" className={getStatusColor(user.status)}>
                                {user.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.applications.slice(0, 2).map((app) => (
                                <Badge key={app} variant="outline" className="text-xs">
                                  {app.split(" ")[0]}
                                </Badge>
                              ))}
                              {user.applications.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{user.applications.length - 2}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(user.lastActive).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Edit User</DialogTitle>
                                    <DialogDescription>Update user role and permissions</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>User</Label>
                                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                          {user.name
                                            .split(" ")
                                            .map((n) => n[0])
                                            .join("")}
                                        </div>
                                        <div>
                                          <div className="font-medium">{user.name}</div>
                                          <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <Label>Role</Label>
                                      <Select
                                        value={user.role}
                                        onValueChange={(value) =>
                                          handleUpdateUser(user.id, { role: value as User["role"] })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {roles.map((role) => (
                                            <SelectItem key={role.value} value={role.value}>
                                              <div>
                                                <div className="font-medium">{role.label}</div>
                                                <div className="text-xs text-muted-foreground">{role.description}</div>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-4">
                                      <Button variant="outline" onClick={() => setEditingUser(null)}>
                                        Cancel
                                      </Button>
                                      <Button onClick={() => setEditingUser(null)}>Save Changes</Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleUserStatus(user.id)}
                                className={user.status === "active" ? "text-yellow-600" : "text-green-600"}
                                disabled={user.role === "owner"}
                              >
                                {user.status === "active" ? "Suspend" : "Activate"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-destructive hover:text-destructive"
                                disabled={user.role === "owner"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No users found</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {searchQuery ? "Try adjusting your search query" : "Invite team members to get started"}
                      </p>
                      {!searchQuery && (
                        <Button onClick={() => setIsInviteModalOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite User
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invitations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Pending Invitations</CardTitle>
                  <CardDescription>Manage sent invitations and their status</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Invited By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{invitation.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getRoleColor(invitation.role)}>
                              {invitation.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{invitation.invitedBy}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(invitation.status)}
                              <Badge variant="secondary" className={getStatusColor(invitation.status)}>
                                {invitation.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {new Date(invitation.expiresAt).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {invitation.status === "pending" && (
                                <Button variant="ghost" size="sm" onClick={() => handleResendInvitation(invitation.id)}>
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              {invitation.status === "expired" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResendInvitation(invitation.id)}
                                  className="text-blue-600"
                                >
                                  Resend
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelInvitation(invitation.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {invitations.length === 0 && (
                    <div className="text-center py-8">
                      <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No pending invitations</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Invite team members to collaborate on your projects
                      </p>
                      <Button onClick={() => setIsInviteModalOpen(true)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite User
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {roles.map((role) => (
                  <Card key={role.value}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">{role.label}</CardTitle>
                          <CardDescription>{role.description}</CardDescription>
                        </div>
                        <Badge variant="secondary" className={getRoleColor(role.value)}>
                          {users.filter((u) => u.role === role.value).length} users
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Permissions:</h4>
                        <div className="space-y-1">
                          {role.value === "owner" && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Full organization access</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Manage billing and settings</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Manage all users and roles</span>
                              </div>
                            </>
                          )}
                          {role.value === "admin" && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Manage users and applications</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Deploy releases</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>View analytics</span>
                              </div>
                            </>
                          )}
                          {role.value === "developer" && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Deploy releases</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>View analytics</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>Manage files and packages</span>
                              </div>
                            </>
                          )}
                          {role.value === "viewer" && (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>View analytics</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Key className="h-3 w-3" />
                                <span>View releases</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}
