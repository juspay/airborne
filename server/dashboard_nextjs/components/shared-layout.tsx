"use client"

import type React from "react"
import { useMemo, useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Activity,
  Package,
  Rocket,
  Search,
  Plus,
  ChevronDown,
  Sliders,
  Eye,
  FileText,
  LogOut,
  Users2,
} from "lucide-react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import Image from "next/image"
import { useAppContext } from "@/providers/app-context"
import { FileCreationModal } from "@/components/file-creation-modal"
import { apiFetch } from "@/lib/api"
import { ThemeToggle } from "@/components/theme-toggle"

interface SharedLayoutProps {
  children: React.ReactNode
  title?: string
}

type NavItem = { href: string; icon: any; label: string };

export default function SharedLayout({ children }: SharedLayoutProps) {
  const { org, app, user, token, setOrg: setOrganisation, setApp: setApplication, logout } = useAppContext()
  const [createFileOpen, setCreateFileOpen] = useState(false)
  const pathname = usePathname()

  const appIdPath = useParams().appId as string;

  const { data: orgsData } = useSWR(token ? "/organisations" : null, (url) => apiFetch<any[]>(url, {}, { token }))
  const organisations: { name: string; applications: { application: string; organisation: string }[] }[] =
    orgsData || []

  const appsForOrg = organisations.find((o) => o.name === org)?.applications?.map((a) => a.application) || []

  const navigationItems: NavItem[] = (appIdPath) ? [
    { href: "/dashboard/" + org + "/" + app, icon: Activity, label: "Overview" },
    { href: "/dashboard/" + org + "/" + app + "/files", icon: FileText, label: "Files" },
    { href: "/dashboard/" + org + "/" + app + "/packages", icon: Package, label: "Packages" },
    { href: "/dashboard/" + org + "/" + app + "/releases", icon: Rocket, label: "Releases" },
    { href: "/dashboard/" + org + "/" + app + "/views", icon: Eye, label: "Views" },
    { href: "/dashboard/" + org + "/" + app + "/dimensions", icon: Sliders, label: "Dimensions" },
  ] : [
    { href: "/dashboard/" + org, icon: Activity, label: "Overview" },
    { href: "/dashboard/" + org + "/users", icon: Users2, label: "Users" },
  ]

  function useIsActive(items: NavItem[]) {
    const pathname = usePathname();

    const normalize = (s: string) => s.replace(/\/+$/, ""); // strip trailing slash
    const match = (href: string) => {
      const p = normalize(pathname);
      const h = normalize(href);
      return p === h || p.startsWith(h + "/");
    };

    const longestMatchHref = useMemo(() => {
      const matches = items.filter(i => match(i.href));
      if (matches.length === 0) return null;
      return matches.reduce((best, i) =>
        i.href.length > best.href.length ? i : best
      ).href;
    }, [items, pathname]);

    return (href: string) => normalize(href) === longestMatchHref;
  }

  const isActive = useIsActive(navigationItems);

  return (
    <div className="min-h-screen bg-background h-full">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-16 rounded-lg flex items-center justify-center">
                <Image src="/airborne-cube-logo.png" alt="Airborne Logo" width={8} height={8} className="h-8 w-8 mr-2 text-primary-foreground"></Image>
              </div>
              <span className="font-bold text-lg font-[family-name:var(--font-space-grotesk)]">Airborne</span>
            </Link>

            <div className="flex items-center gap-2 text-sm">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                    {org || "Select Org"} <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {organisations.map((o) => (
                    <DropdownMenuItem
                      key={o.name}
                      onClick={() => {
                        setOrganisation(o.name)
                        setApplication("")
                      }}
                    >
                      {o.name}
                    </DropdownMenuItem>
                  ))}
                  {organisations.length === 0 && <DropdownMenuItem disabled>No organisations</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-muted-foreground">›</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    disabled={!org}
                  >
                    {app || "Select App"} <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {appsForOrg.map((a) => (
                    <DropdownMenuItem key={a} onClick={() => setApplication(a)}>
                      {a}
                    </DropdownMenuItem>
                  ))}
                  {org && appsForOrg.length === 0 && <DropdownMenuItem disabled>No applications</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search…" className="pl-10 bg-muted/50 border-0 focus-visible:ring-1" />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Badge variant="secondary" className="text-xs">
              {user?.name || user?.user_id || "GUEST"}
            </Badge>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-2" disabled={!org || !app}>
                <Plus className="h-4 w-4" />
                Create
                <ChevronDown className="h-3 w-3" />
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!org || !app} onClick={() => setCreateFileOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Create File
              </DropdownMenuItem>
              <DropdownMenuItem asChild disabled={!org || !app}>
                <Link href="/dashboard/packages/create">
                <Package className="mr-2 h-4 w-4" />
                Create Package
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild disabled={!org || !app}>
                <Link href="/dashboard/releases/create">
                <Rocket className="mr-2 h-4 w-4" />
                New Release
                </Link>
              </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
        </div>
      </header>

      <div className="flex">
        <aside className="min-h-screen w-64 border-r border-border bg-sidebar/50 backdrop-blur supports-[backdrop-filter]:bg-sidebar/50">
          <nav className="p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Application</div>
            {navigationItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  className={`w-full justify-start gap-3 ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              )
            })}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>

      <FileCreationModal open={createFileOpen} onOpenChange={setCreateFileOpen} />
    </div>
  )
}
