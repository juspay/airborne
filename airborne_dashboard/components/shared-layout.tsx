"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  History,
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
  TowerControl,
  Menu,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useAppContext } from "@/providers/app-context";
import { FileCreationModal } from "@/components/file-creation-modal";
import { apiFetch } from "@/lib/api";
import { ORG_APP_NAME_MAX_LENGTH, ORG_APP_NAME_RULE_TEXT, validateOrgAppName } from "@/lib/name-validation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { OrganisationsList } from "@/app/dashboard/page";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { ScopePicker } from "@/components/scope/scope-picker";
import { CreateChooser } from "@/components/scope/create-chooser";
import { cn } from "@/lib/utils";
import { QUIET_BUTTON } from "@/components/scope/quiet-focus";
import { useScope } from "@/components/scope/use-scope";
import { useRememberedScope } from "@/components/scope/use-remembered-scope";
import { useScopeGroups } from "@/lib/control-center/hooks";
import {
  appChoices,
  appKnown,
  APPROVALS_BASE,
  buildScopeTree,
  CC_BASE,
  DEPLOYMENTS_BASE,
  overviewHref,
  scopedHref,
} from "@/lib/control-center/scope";

interface SharedLayoutProps {
  children: React.ReactNode;
  title?: string;
}

type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string };
/**
 * A heading and its links. The heading names what the links belong to: Control Center, an organisation, an
 * application. All headings look the same; the kind comes first so a name is never taken for another kind.
 */
type NavSection = { key: string; heading: string; items: NavItem[] };

// One line, always: a long name is cut with an ellipsis and the full heading is the tooltip (title). A heading that
// wraps makes one section taller than another for no reason a person can use.
const HEADING_CLASS =
  "truncate px-3 pb-1 text-[11px] font-semibold uppercase leading-snug tracking-wider text-muted-foreground";

const LAYOUT_AUTHZ = definePagePermissions({
  create_file: permission("file", "create", "app"),
  create_package: permission("package", "create", "app"),
  create_release: permission("release", "create", "app"),
  read_tokens: permission("token", "read", "app"),
});

export default function SharedLayout({ children }: SharedLayoutProps) {
  const { org, app, setOrg, setApp, user, token, logout, config } = useAppContext();
  const permissions = usePagePermissions(LAYOUT_AUTHZ);
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
  const requestOrgNameError = useMemo(() => validateOrgAppName(reqOrgName, "Organisation"), [reqOrgName]);
  const createOrgNameError = useMemo(() => validateOrgAppName(orgName, "Organisation"), [orgName]);

  const pathname = usePathname();
  const scope = useScope();

  const canReadTokens = permissions.can("read_tokens");
  const canCreateFile = permissions.can("create_file");
  const canCreatePackage = permissions.can("create_package");
  const canCreateRelease = permissions.can("create_release");
  const canShowCreateMenu = canCreateFile || canCreatePackage || canCreateRelease;

  const { data: orgsData } = useSWR(token ? "/organisations" : null, (url) =>
    apiFetch<OrganisationsList>(url, {}, { token })
  );
  const organisations = useMemo(
    () =>
      (orgsData?.organisations ?? []) as {
        name: string;
        applications: { application: string; organisation: string }[];
      }[],
    [orgsData]
  );

  // The scope in the URL is the truth. The context keeps following it for the places that still read it (Create, the
  // file dialog): never an application the URL does not name, and never an organisation the caller does not have
  // (a mistyped ?org= must not send permission checks to an organisation that is not theirs).
  const orgKnown = organisations.some((o) => o.name === scope.org);
  useRememberedScope(scope, organisations);
  // An application the URL names but the caller does not have (mistyped, another organisation's, no access) is not
  // offered a sidebar section or a Create: the page says it was not found.
  const appIsKnown = appKnown(organisations, scope.org, scope.app) === true;
  const scopedApp = scope.org && scope.app && orgKnown && appIsKnown ? { org: scope.org, app: scope.app } : null;
  useEffect(() => {
    if (scope.org && orgKnown && scope.org !== org) setOrg(scope.org);
    if (!scope.app || (orgKnown && !appIsKnown)) {
      if (app !== null) setApp(null);
    } else if (orgKnown && appIsKnown && (pathname ?? "").startsWith(CC_BASE) && scope.app !== app) {
      setApp(scope.app);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.org, scope.app, pathname, orgKnown, appIsKnown]);

  // "Which app?": Create is always in the top bar, and asks first when no application is in scope.
  const [chooserOpen, setChooserOpen] = useState(false);
  const [picked, setPicked] = useState<{ org: string; app: string } | null>(null);
  const [fileFromChooser, setFileFromChooser] = useState(false);
  const orgNames = useMemo(() => organisations.map((o) => o.name), [organisations]);
  const { groupsByOrg } = useScopeGroups(chooserOpen ? orgNames : [], chooserOpen && Boolean(scope.group));
  const choices = useMemo(
    () => (chooserOpen ? appChoices(buildScopeTree(organisations, groupsByOrg), scope) : []),
    [chooserOpen, organisations, groupsByOrg, scope]
  );
  // The chooser borrows the context (the permission checks and the file dialog read it); give it back to the URL.
  const restoreContext = () => {
    if (scope.org && orgKnown && scope.org !== org) setOrg(scope.org);
    const wanted = scopedApp ? scopedApp.app : null;
    if (wanted !== app) setApp(wanted);
  };
  const closeChooser = (keepContext = false) => {
    setChooserOpen(false);
    setPicked(null);
    if (!keepContext) restoreContext();
  };
  const pickedReady = picked !== null && org === picked.org && app === picked.app && permissions.isReady;

  const resetOrgRequestForm = () => {
    setReqOrgName("");
    setName("");
    setEmail("");
    setAppStoreLink("");
    setPlayStoreLink("");
  };
  const onRequestOrg = async () => {
    if (requestOrgNameError) return;
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

  const scopedLinks = (base: string) => scopedHref(base, scope);
  const orgBase = "/dashboard/" + encodeURIComponent(scope.org || "");
  const appBase = orgBase + "/" + encodeURIComponent(scope.app || "");

  // Control Center pages follow the scope; at application scope the Overview is that application's own page. The
  // organisation's pages stay in view when an application is in scope, and the application's pages sit in their own
  // section, named as the application's (so "App users" is never mistaken for the organisation's Users).
  const navSections: NavSection[] = [
    {
      key: "cc",
      heading: "Control Center",
      items: [
        { href: overviewHref(scope), icon: TowerControl, label: "Overview" },
        { href: scopedLinks(DEPLOYMENTS_BASE), icon: History, label: "Deployments" },
        { href: scopedLinks(APPROVALS_BASE), icon: UserCheck, label: "Approvals" },
      ],
    },
    ...(scope.org && orgKnown
      ? [
          {
            key: "org",
            heading: `Organisation · ${scope.org}`,
            items: [
              { href: orgBase, icon: Activity, label: "Applications" },
              { href: orgBase + "/users", icon: Users2, label: "Users" },
            ],
          },
        ]
      : []),
    ...(scopedApp
      ? [
          {
            key: "app",
            heading: `Application · ${scopedApp.app}`,
            items: [
              { href: appBase + "/files", icon: FileText, label: "Files" },
              { href: appBase + "/packages", icon: Package, label: "Packages" },
              { href: appBase + "/releases", icon: Rocket, label: "Releases" },
              { href: appBase + "/views", icon: Eye, label: "Views" },
              { href: appBase + "/dimensions", icon: Sliders, label: "Dimensions" },
              { href: appBase + "/users", icon: Users2, label: "App users" },
              ...(canReadTokens ? [{ href: appBase + "/token", icon: Lock, label: "Tokens" }] : []),
              { href: appBase + "/remote-configs", icon: Settings, label: "Remote Configs" },
              { href: appBase + "/cohorts", icon: Users, label: "Cohorts" },
            ],
          },
        ]
      : []),
  ];

  // The link whose path is the longest prefix of where we are. Queries are not part of a link's identity.
  const isActive = useMemo(() => {
    const norm = (x: string) => x.split("?")[0].replace(/\/+$/, "");
    const here = norm(pathname ?? "");
    const hrefs = navSections.flatMap((sec) => sec.items.map((i) => norm(i.href)));
    const best = hrefs
      .filter((h) => here === h || here.startsWith(h + "/"))
      .reduce<string | null>((x, h) => (x === null || h.length > x.length ? h : x), null);
    return (href: string) => best !== null && norm(href) === best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, scope.org, scope.app, canReadTokens, orgKnown, appIsKnown]);
  const onCreateOrg = async () => {
    if (createOrgNameError) return;
    await apiFetch("/organisations/create", { method: "POST", body: { name: orgName } }, { token, logout });
    const createdOrg = orgName;
    setOrgName("");
    router.push(`/dashboard/${createdOrg}`);
    setIsOrgCreateModelOpen(false);
  };

  const showSidebar = organisations.length > 0 && !(pathname ?? "").startsWith("/dashboard/onboarding");
  // Create in the application the URL names, when the context has caught up with it.
  const createTarget = scopedApp && org === scopedApp.org && app === scopedApp.app ? scopedApp : null;
  const createRequest = Boolean(config?.organisation_creation_disabled && !user?.is_super_admin);

  const navLinks = (section: NavSection) =>
    section.items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Button
          key={item.href}
          variant="ghost"
          className={`h-9 w-full justify-start gap-3 ${
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
          asChild
        >
          <Link href={item.href} aria-current={active ? "page" : undefined}>
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        </Button>
      );
    });

  /** The three things Create offers, for the application in scope (or the one just picked in the chooser). */
  const createItems = (target: { org: string; app: string } | null = createTarget) => {
    const base = target
      ? `/dashboard/${encodeURIComponent(target.org)}/${encodeURIComponent(target.app)}`
      : "/dashboard";
    return (
      <>
        <DropdownMenuItem disabled={!target || !canCreateFile} onClick={() => setCreateFileOpen(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Create File
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={!target || !canCreatePackage}>
          <Link href={`${base}/packages/create`}>
            <Package className="mr-2 h-4 w-4" />
            Create Package
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={!target || !canCreateRelease}>
          <Link href={`${base}/releases/create`}>
            <Rocket className="mr-2 h-4 w-4" />
            New Release
          </Link>
        </DropdownMenuItem>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background h-full">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
        {/* Below md the scope picker takes a row of its own, so the scope is as readable on a phone as on a desktop. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 md:h-20 md:flex-nowrap md:py-0">
          <div className="flex items-center gap-2">
            {/* The sidebar is hidden below md, so the same links (and Create) live in this menu. */}
            {showSidebar && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60">
                  {navSections.map((section, i) => (
                    <div key={section.key}>
                      {i > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel
                        title={section.heading}
                        className="truncate text-[11px] uppercase tracking-wider text-muted-foreground"
                      >
                        {section.heading}
                      </DropdownMenuLabel>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <DropdownMenuItem
                            key={item.href}
                            asChild
                            className={isActive(item.href) ? "bg-accent" : undefined}
                          >
                            <Link href={item.href}>
                              <Icon className="mr-2 h-4 w-4" />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                  {scopedApp ? (
                    createItems()
                  ) : (
                    <DropdownMenuItem onClick={() => setChooserOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create…
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-10 items-center justify-center rounded-lg md:h-20">
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
          </div>

          {organisations.length > 0 && (
            <div className="order-last w-full min-w-0 md:order-none md:w-auto md:max-w-[min(34rem,45vw)]">
              <ScopePicker
                onCreateOrg={() => setIsOrgCreateModelOpen(true)}
                createOrgLabel={createRequest ? "Request an organisation" : "Create an organisation"}
              />
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
              {user?.name || user?.user_id || "GUEST"}
            </Badge>
            <ThemeToggle />
            {scopedApp ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="hidden gap-2 md:inline-flex"
                    disabled={!createTarget || !permissions.isReady || !canShowCreateMenu}
                    title={
                      permissions.isReady && !canShowCreateMenu
                        ? "Your role cannot create files, packages or releases in this application"
                        : undefined
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Create
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{createItems()}</DropdownMenuContent>
              </DropdownMenu>
            ) : (
              // No application in scope: Create asks which one first.
              <Button size="sm" className="hidden gap-2 md:inline-flex" onClick={() => setChooserOpen(true)}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
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

      {/* At least a window tall, so the sidebar reaches the bottom of the window on a short page too. */}
      <div className="flex min-h-[calc(100vh-5rem)]">
        {showSidebar && (
          // The aside stretches the full height of the page, so its background and rule never stop partway down a long
          // page; the links inside stick under the header and scroll on their own when they are taller than the window.
          <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:block">
            <nav aria-label="Primary" className="sticky top-20 max-h-[calc(100vh-5rem)] space-y-5 overflow-y-auto p-4">
              {navSections.map((section) => (
                <div key={section.key} className="space-y-1" role="group" aria-label={section.heading}>
                  <p className={HEADING_CLASS} title={section.heading}>
                    {section.heading}
                  </p>
                  {navLinks(section)}
                </div>
              ))}
            </nav>
          </aside>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <FileCreationModal
        open={createFileOpen}
        onOpenChange={(o) => {
          setCreateFileOpen(o);
          if (!o && fileFromChooser) {
            setFileFromChooser(false);
            restoreContext();
          }
        }}
      />
      <CreateChooser
        open={chooserOpen}
        onOpenChange={(o) => !o && closeChooser(false)}
        choices={choices}
        showOrg={!scope.org}
        picked={picked}
        onPick={(c) => {
          setOrg(c.org);
          setApp(c.app);
          setPicked(c);
        }}
        onBack={() => {
          setPicked(null);
          restoreContext();
        }}
      >
        {!pickedReady ? (
          <p className="text-sm text-muted-foreground" role="status">
            Checking what you can create here…
          </p>
        ) : !canShowCreateMenu ? (
          <p className="text-sm text-muted-foreground" role="status">
            Your role cannot create files, packages or releases in this application.
          </p>
        ) : (
          <div className="grid gap-2">
            <Button
              variant="outline"
              className={cn("justify-start gap-2", QUIET_BUTTON)}
              disabled={!canCreateFile}
              onClick={() => {
                setFileFromChooser(true);
                closeChooser(true);
                setCreateFileOpen(true);
              }}
            >
              <FileText className="h-4 w-4" /> Create File
            </Button>
            <Button
              variant="outline"
              className={cn("justify-start gap-2", QUIET_BUTTON)}
              disabled={!canCreatePackage}
              asChild
            >
              <Link
                href={`/dashboard/${encodeURIComponent(picked?.org ?? "")}/${encodeURIComponent(picked?.app ?? "")}/packages/create`}
                onClick={() => closeChooser(true)}
              >
                <Package className="h-4 w-4" /> Create Package
              </Link>
            </Button>
            <Button
              variant="outline"
              className={cn("justify-start gap-2", QUIET_BUTTON)}
              disabled={!canCreateRelease}
              asChild
            >
              <Link
                href={`/dashboard/${encodeURIComponent(picked?.org ?? "")}/${encodeURIComponent(picked?.app ?? "")}/releases/create`}
                onClick={() => closeChooser(true)}
              >
                <Rocket className="h-4 w-4" /> New Release
              </Link>
            </Button>
          </div>
        )}
      </CreateChooser>
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
                        <Input
                          id="orgName"
                          value={reqOrgName}
                          maxLength={ORG_APP_NAME_MAX_LENGTH}
                          onChange={(e) => setReqOrgName(e.target.value)}
                        />
                        {reqOrgName.length > 0 && requestOrgNameError ? (
                          <p className="text-xs text-destructive">{requestOrgNameError}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">{ORG_APP_NAME_RULE_TEXT}</p>
                        )}
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
                      <Button
                        onClick={onRequestOrg}
                        disabled={Boolean(requestOrgNameError) || !name.trim() || !email.trim()}
                      >
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
                      placeholder="acme_corp"
                      value={orgName}
                      maxLength={ORG_APP_NAME_MAX_LENGTH}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                    {orgName.length > 0 && createOrgNameError ? (
                      <p className="text-xs text-destructive">{createOrgNameError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{ORG_APP_NAME_RULE_TEXT}</p>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOrgCreateModelOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={onCreateOrg} disabled={Boolean(createOrgNameError)}>
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
