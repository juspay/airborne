"use client";

import type React from "react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  Package,
  Rocket,
  Plus,
  ChevronDown,
  Sliders,
  Eye,
  FileText,
  LogOut,
  Lock,
  Users2,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAppContext } from "@/providers/app-context";
import { FileCreationModal } from "@/components/file-creation-modal";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { OrganisationsList } from "@/app/dashboard/page";
import { hasAppAccess } from "@/lib/utils";

interface SharedLayoutProps {
  children: React.ReactNode;
  title?: string;
}

type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string };

export default function SharedLayout({ children }: SharedLayoutProps) {
  const { org, app, user, token, logout, getOrgAccess, getAppAccess, config } = useAppContext();
  const [isOrgCreateModelOpen, setIsOrgCreateModelOpen] = useState(false);
  const [orgName, setOrgName] = useState<string>("");
  const router = useRouter();
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [reqOrgName, setReqOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [appStoreLink, setAppStoreLink] = useState("");
  const [playStoreLink, setPlayStoreLink] = useState("");
  const [orgRequestSuccess, setOrgRequestSuccess] = useState(false);

  // pathname is used in the useIsActive function below
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pathname = usePathname();

  const appIdPath = useParams().appId as string;

  const { data: orgsData } = useSWR(token ? "/organisations" : null, (url) =>
    apiFetch<OrganisationsList>(url, {}, { token })
  );
  const organisations: {
    name: string;
    applications: { application: string; organisation: string }[];
  }[] = orgsData?.organisations || [];

  const appsForOrg = organisations.find((o) => o.name === org)?.applications?.map((a) => a.application) || [];
  const resetOrgRequestForm = () => {
    setReqOrgName("");
    setName("");
    setEmail("");
    setAppStoreLink("");
    setPlayStoreLink("");
  };
  const onRequestOrg = async () => {
    try {
      await apiFetch(
        "/organisations/request",
        {
          method: "POST",
          body: {
            organisation_name: reqOrgName,
            name,
            email,
            app_store_link: appStoreLink,
            play_store_link: playStoreLink,
          },
        },
        {
          token,
        }
      );

      // Save request data to local storage
      const requestData = {
        organisation_name: reqOrgName,
        name,
        email,
        app_store_link: appStoreLink,
        play_store_link: playStoreLink,
        requested_at: new Date().toISOString(),
      };
      localStorage.setItem("org_request_data", JSON.stringify(requestData));

      // Show success message
      setOrgRequestSuccess(true);
      resetOrgRequestForm();
      setTimeout(() => {
        setOrgRequestSuccess(false);
        setIsOrgCreateModelOpen(false);
      }, 3000);
    } catch (err) {
      console.error("Error while requesting organisation:", err);
    }
  };

  const navigationItems: NavItem[] = appIdPath
    ? [
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || ""),
          icon: Activity,
          label: "Overview",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/files",
          icon: FileText,
          label: "Files",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/packages",
          icon: Package,
          label: "Packages",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/releases",
          icon: Rocket,
          label: "Releases",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/views",
          icon: Eye,
          label: "Views",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/dimensions",
          icon: Sliders,
          label: "Dimensions",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/users",
          icon: Users2,
          label: "Users",
        },
        ...(hasAppAccess(getOrgAccess(org), getAppAccess(org, app), "admin")
          ? [
              {
                href: `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/token`,
                icon: Lock,
                label: "Tokens",
              },
            ]
          : []),
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/remote-configs",
          icon: Settings,
          label: "Remote Configs",
        },
        {
          href: "/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(app || "") + "/cohorts",
          icon: Users,
          label: "Cohorts",
        },
      ]
    : [
        { href: "/dashboard/" + encodeURIComponent(org || ""), icon: Activity, label: "Overview" },
        { href: "/dashboard/" + encodeURIComponent(org || "") + "/users", icon: Users2, label: "Users" },
      ];

  function useIsActive(items: NavItem[]) {
    const normalize = (s: string) => s.replace(/\/+$/, ""); // strip trailing slash
    const match = (href: string) => {
      const p = normalize(pathname);
      const h = normalize(href);
      return p === h || p.startsWith(h + "/");
    };

    const longestMatchHref = useMemo(() => {
      const matches = items.filter((i) => match(i.href));
      if (matches.length === 0) return null;
      return matches.reduce((best, i) => (i.href.length > best.href.length ? i : best)).href;
    }, [items]);

    return (href: string) => normalize(href) === longestMatchHref;
  }

  const isActive = useIsActive(navigationItems);
  const onCreateOrg = async () => {
    await apiFetch("/organisations/create", { method: "POST", body: { name: orgName } }, { token, logout });
    const createdOrg = orgName;
    setOrgName("");
    router.push(`/dashboard/${createdOrg}`);
    setIsOrgCreateModelOpen(false);
  };

  return (
    <div className="min-h-screen bg-background h-full">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
        <div className="flex h-20 items-center px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-20 rounded-lg flex items-center justify-center">
                <Image
                  src="/airborne-logo-light.svg"
                  alt="Airborne Logo"
                  width={28}
                  height={12}
                  className="w-28 mr-2 text-primary-foreground dark:hidden"
                />
                <Image
                  src="/airborne-logo-dark.svg"
                  alt="Airborne Logo"
                  width={28}
                  height={12}
                  className="w-28 mr-2 text-primary-foreground hidden dark:block"
                />
              </div>
            </Link>
            {organisations.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                      {org || "Select Org"} <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {config?.organisation_creation_disabled && !user?.is_super_admin ? (
                      <DropdownMenuItem
                        onClick={() => setIsOrgCreateModelOpen(true)}
                        className="my-1 cursor-pointer rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:bg-primary/90"
                      >
                        + Request Organisation
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => setIsOrgCreateModelOpen(true)}
                        className="my-1 cursor-pointer rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 focus:bg-primary/90"
                      >
                        + Create Organisation
                      </DropdownMenuItem>
                    )}

                    {organisations.map((o) => (
                      <DropdownMenuItem
                        key={o.name}
                        onClick={() => {
                          router.push("/dashboard/" + o.name);
                        }}
                        className="cursor-pointer"
                      >
                        {o.name}
                      </DropdownMenuItem>
                    ))}
                    {organisations.length === 0 && <DropdownMenuItem disabled>No organisations</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Badge variant="secondary" className="text-xs">
              {user?.name || user?.user_id || "GUEST"}
            </Badge>
            <ThemeToggle />
            {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
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
                    <Link
                      href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages/create`}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Create Package
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild disabled={!org || !app}>
                    <Link
                      href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/create`}
                    >
                      <Rocket className="mr-2 h-4 w-4" />
                      New Release
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

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
        {org && (
          <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r border-border bg-sidebar/50 backdrop-blur supports-[backdrop-filter]:bg-sidebar/50 overflow-y-auto">
            <nav className="p-4 space-y-2">
              {app && (
                <div className="flex items-center gap-2 text-sm">
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
                        <DropdownMenuItem key={a} onClick={() => router.push("/dashboard/" + org + "/" + a)}>
                          {a}
                        </DropdownMenuItem>
                      ))}
                      {org && appsForOrg.length === 0 && <DropdownMenuItem disabled>No applications</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
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
                );
              })}
            </nav>
          </aside>
        )}
        <main className="flex-1">{children}</main>
      </div>

      <FileCreationModal open={createFileOpen} onOpenChange={setCreateFileOpen} />
      {isOrgCreateModelOpen && (
        <Dialog open={isOrgCreateModelOpen} onOpenChange={setIsOrgCreateModelOpen}>
          <DialogContent className="sm:max-w-md">
            {config?.organisation_creation_disabled && !user?.is_super_admin ? (
              <>
                {orgRequestSuccess ? (
                  <>
                    <DialogHeader>
                      <DialogTitle>Request Sent</DialogTitle>
                      <DialogDescription>Your organisation request has been sent successfully.</DialogDescription>
                    </DialogHeader>
                  </>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle>Request Organisation</DialogTitle>
                      <DialogDescription>Fill out the form below to request a new organisation.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="orgName">Organisation name*</Label>
                        <Input id="orgName" value={reqOrgName} onChange={(e) => setReqOrgName(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="name">Your name*</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">Email*</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="appStoreLink">App Store Link</Label>
                        <Input
                          id="appStoreLink"
                          value={appStoreLink}
                          onChange={(e) => setAppStoreLink(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="playStoreLink">Play Store Link</Label>
                        <Input
                          id="playStoreLink"
                          value={playStoreLink}
                          onChange={(e) => setPlayStoreLink(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsOrgCreateModelOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={onRequestOrg} disabled={!reqOrgName.trim() || !name.trim() || !email.trim()}>
                        Request
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create Organisation</DialogTitle>
                  <DialogDescription>Please enter the name of your organisation.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organisation Name</Label>
                    <Input
                      id="orgName"
                      placeholder="Acme Corp"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOrgCreateModelOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={onCreateOrg} disabled={!orgName.trim()}>
                    Create
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
