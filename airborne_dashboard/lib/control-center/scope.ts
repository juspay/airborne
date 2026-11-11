// The one scope every Control Center page shares: All, then an organisation, a group, an application.
// It lives in the URL. Pages that already carry it in their path (an application's page, a group's page, the classic
// application pages) are read from the path; the pages that do not (overview, deployments, approvals) read `?org=&group=&app=`.
// Pure functions only, so the rules can be tested without a browser.

import type { AppGroup, AppStatus, Overview, OverviewGroup, OverviewOrganisation } from "./types";
import { appPath } from "@/components/control-center/paths";

export interface Scope {
  org?: string;
  /** Group id, never its display name. */
  group?: string;
  app?: string;
}

export type ScopeLevel = "all" | "org" | "group" | "app";

export const CC_BASE = "/dashboard/control-center";
export const DEPLOYMENTS_BASE = `${CC_BASE}/deployments`;
export const APPROVALS_BASE = `${CC_BASE}/approvals`;

/** The three pages that take their scope from the query string rather than from the path. */
export const QUERY_SCOPED_PAGES = [CC_BASE, DEPLOYMENTS_BASE, APPROVALS_BASE];

export function scopeLevel(s: Scope): ScopeLevel {
  if (s.app) return "app";
  if (s.group) return "group";
  if (s.org) return "org";
  return "all";
}

export function sameScope(a: Scope, b: Scope): boolean {
  return (a.org ?? "") === (b.org ?? "") && (a.group ?? "") === (b.group ?? "") && (a.app ?? "") === (b.app ?? "");
}

/** Drop what cannot hold: a group or an application without an organisation reads as no scope at all for that part. */
export function normaliseScope(s: Scope): Scope {
  const org = s.org?.trim() || undefined;
  const group = org ? s.group?.trim() || undefined : undefined;
  const app = org ? s.app?.trim() || undefined : undefined;
  return { ...(org ? { org } : {}), ...(group ? { group } : {}), ...(app ? { app } : {}) };
}

type Search = { get(name: string): string | null };

function clean(path: string): string[] {
  return path
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

/**
 * Read the scope from where the user is. Path first (the page names its subject), then the query.
 * `/dashboard`, the organisation list and onboarding are All.
 */
export function scopeFromLocation(pathname: string, search?: Search | null): Scope {
  const seg = clean(pathname);
  if (seg[0] !== "dashboard") return {};
  if (seg[1] === "control-center") {
    // /dashboard/control-center/<org>/apps/<app>...   /dashboard/control-center/<org>/groups/<group>
    if (seg.length >= 5 && seg[3] === "apps") return { org: seg[2], app: seg[4] };
    if (seg.length >= 5 && seg[3] === "groups") return { org: seg[2], group: seg[4] };
    return normaliseScope({
      org: search?.get("org") ?? undefined,
      group: search?.get("group") ?? undefined,
      app: search?.get("app") ?? undefined,
    });
  }
  if (seg[1] === undefined || seg[1] === "onboarding") return {};
  // Classic: /dashboard/<org>, /dashboard/<org>/users, /dashboard/<org>/<app>/...
  if (seg[2] === undefined || seg[2] === "users") return { org: seg[1] };
  return { org: seg[1], app: seg[2] };
}

export function scopeSearch(s: Scope, extra?: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  const n = normaliseScope(s);
  if (n.org) q.set("org", n.org);
  if (n.group) q.set("group", n.group);
  if (n.app) q.set("app", n.app);
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v === undefined || v === "") continue;
    for (const one of Array.isArray(v) ? v : [v]) q.append(k, one);
  }
  const text = q.toString();
  return text ? `?${text}` : "";
}

/** A link to one of the query-scoped pages that keeps the scope. */
export function scopedHref(base: string, s: Scope, extra?: Record<string, string | string[] | undefined>): string {
  return `${base}${scopeSearch(s, extra)}`;
}

/**
 * Where choosing `next` takes the user from `pathname`. An application opens its own page: at application scope the
 * Overview is that page. Deployments and Approvals stay the kind of page they are, narrowed to the new scope; an
 * application's classic page stays the same classic page for another application; the rest open the overview.
 */
export function scopeTarget(
  pathname: string,
  next: Scope,
  keep?: Record<string, string | string[] | undefined>
): string {
  const n = normaliseScope(next);
  const here = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  // `keep` (the deployments filters) rides along only on the query-scoped pages that use it.
  for (const base of [DEPLOYMENTS_BASE, APPROVALS_BASE])
    if (here === base) return scopedHref(base, n, base === DEPLOYMENTS_BASE ? keep : undefined);

  const seg = clean(here);
  // Classic application page -> the same page of another application.
  if (seg[0] === "dashboard" && seg[1] !== "control-center" && seg[1] !== "onboarding" && n.org && n.app) {
    const sameKind = seg.length >= 3 && seg[2] !== "users";
    if (sameKind) {
      // One segment of tail ("files", "releases"): a release or edit page names a record of the old application.
      return "/dashboard/" + [n.org, n.app, ...seg.slice(3, 4)].map(encodeURIComponent).join("/");
    }
  }
  if (n.org && n.app) return appPath(n.org, n.app);
  return scopedHref(CC_BASE, n);
}

/** The link the sidebar's Overview takes at this scope: the application's own page when one is in scope. */
export function overviewHref(s: Scope): string {
  const n = normaliseScope(s);
  return n.org && n.app ? appPath(n.org, n.app) : scopedHref(CC_BASE, n);
}

// ---------------------------------------------------------------------------
// Filtering the overview by scope
// ---------------------------------------------------------------------------

function inOrg(o: OverviewOrganisation, s: Scope): boolean {
  return !s.org || o.name === s.org;
}

/** A read that was cut short: the organisation's applications or groups may be missing from what the server returned. */
export function readCutShort(o: OverviewOrganisation): boolean {
  return Boolean(o.authorization_error || o.groups_error);
}

/**
 * A cut-short read that lists nothing for the organisation. What is missing could be anything, so no count, empty
 * state or "create an application" prompt may be drawn from it: the page says it could not confirm, and offers Retry.
 */
export function unconfirmedOrg(o: OverviewOrganisation): boolean {
  return readCutShort(o) && o.groups.every((g) => g.members.length === 0) && o.ungrouped.length === 0;
}

/**
 * The overview narrowed to a scope. An unknown organisation, group or application gives no organisations: the
 * caller shows "not found or no access", never an empty page that reads as healthy. An organisation whose read was
 * cut short is kept when a group or application filter finds nothing in it, because the missing item may be exactly
 * what the failed read dropped; `scopeOutcome` then says "could not be confirmed", not "does not exist".
 */
export function filterOverview(overview: Overview | undefined, scope: Scope): Overview | undefined {
  if (!overview) return overview;
  const s = normaliseScope(scope);
  if (!s.org && !s.group && !s.app) return overview;
  const organisations: OverviewOrganisation[] = [];
  for (const o of overview.organisations) {
    if (!inOrg(o, s)) continue;
    let groups: OverviewGroup[] = o.groups;
    let ungrouped: AppStatus[] = o.ungrouped;
    if (s.group) {
      groups = groups.filter((g) => g.id === s.group);
      ungrouped = [];
      if (groups.length === 0) {
        if (readCutShort(o)) organisations.push({ ...o, groups, ungrouped });
        continue;
      }
    }
    if (s.app) {
      groups = groups
        .map((g) => ({ ...g, members: g.members.filter((m) => m.application === s.app) }))
        .filter((g) => g.members.length > 0);
      ungrouped = ungrouped.filter((m) => m.application === s.app);
      if (groups.length === 0 && ungrouped.length === 0) {
        if (readCutShort(o)) organisations.push({ ...o, groups, ungrouped });
        continue;
      }
    }
    organisations.push({ ...o, groups, ungrouped });
  }
  return { ...overview, organisations };
}

/**
 * What a scope's overview says about the scope itself.
 *  - `found`: it holds something, or it is an organisation (an organisation with no applications is real, unless its
 *    read was cut short, which makes "no applications" unknown).
 *  - `unconfirmed`: a group or application was not found, or an organisation lists nothing, but the read that would
 *    have listed it was cut short.
 *  - `not_found`: nothing by that name that the caller can read. Says nothing about whether it is healthy.
 * `undefined` while the overview is not loaded.
 */
export type ScopeOutcome = "found" | "unconfirmed" | "not_found";
export function scopeOutcome(filtered: Overview | undefined, scope: Scope): ScopeOutcome | undefined {
  if (!filtered) return undefined;
  const s = normaliseScope(scope);
  if (!s.org) return "found";
  if (filtered.organisations.length === 0) return "not_found";
  if (!s.group && !s.app) return filtered.organisations.every(unconfirmedOrg) ? "unconfirmed" : "found";
  const apps = filtered.organisations.reduce(
    (n, o) => n + o.groups.reduce((c, g) => c + g.members.length, 0) + o.ungrouped.length,
    0
  );
  if (apps === 0) return filtered.organisations.some(readCutShort) ? "unconfirmed" : "not_found";
  return "found";
}

// ---------------------------------------------------------------------------
// The picker's tree
// ---------------------------------------------------------------------------

export interface ScopeNode {
  org: string;
  groups: { id: string; name: string; apps: { application: string }[] }[];
  ungrouped: { application: string }[];
}

/**
 * Organisations and their applications come from `/organisations`; groups from `/control-center/groups`, which an
 * organisation may refuse (no `app_group` read). A refused or failed groups read leaves that organisation's
 * applications flat rather than hiding them.
 */
export function buildScopeTree(
  organisations: { name: string; applications: { application: string }[] }[],
  groupsByOrg: Record<string, AppGroup[] | undefined>
): ScopeNode[] {
  return organisations.map((o) => {
    const known = new Set(o.applications.map((a) => a.application));
    const groups = (groupsByOrg[o.name] ?? [])
      .map((g) => ({
        id: g.id,
        name: g.name,
        // A group can name an application the caller cannot read: it is not offered.
        apps: g.members.filter((m) => known.has(m.application)).map((m) => ({ application: m.application })),
      }))
      .filter((g) => g.apps.length > 0);
    const grouped = new Set(groups.flatMap((g) => g.apps.map((a) => a.application)));
    return {
      org: o.name,
      groups,
      ungrouped: o.applications.filter((a) => !grouped.has(a.application)).map((a) => ({ application: a.application })),
    };
  });
}

export type PickerRow = {
  kind: "all" | "org" | "group" | "app";
  key: string;
  scope: Scope;
  label: string;
  /** The row's own name matches the search (not merely a parent or child of a match). */
  match: boolean;
  /** An organisation row: how many applications sit under it, and whether they are listed now. */
  apps?: number;
  expanded?: boolean;
};

/**
 * Is this picker row the scope the person is in? An application in the URL path carries no group, while the row for
 * the same application sits under its group, so rows are compared by the deepest level the scope names.
 */
export function rowIsCurrent(row: Pick<PickerRow, "kind" | "scope">, scope: Scope): boolean {
  const s = normaliseScope(scope);
  if (s.app) return row.kind === "app" && row.scope.org === s.org && row.scope.app === s.app;
  if (s.group) return row.kind === "group" && row.scope.org === s.org && row.scope.group === s.group;
  if (s.org) return row.kind === "org" && row.scope.org === s.org;
  return row.kind === "all";
}

/** The flat, indented list the picker shows. A search keeps every match's parents so the match is placed. */
export function pickerRows(tree: ScopeNode[], query: string, expanded: ReadonlySet<string> = new Set()): PickerRow[] {
  const q = query.trim().toLowerCase();
  const hit = (s: string) => q === "" || s.toLowerCase().includes(q);
  const rows: PickerRow[] = [];
  if (q === "" || "all organisations".startsWith(q)) {
    rows.push({ kind: "all", key: "all", scope: {}, label: "All organisations", match: q !== "" });
  }
  for (const n of tree) {
    const orgHit = hit(n.org);
    const groups = n.groups
      .map((g) => ({
        g,
        groupHit: orgHit || hit(g.name),
        apps: g.apps.filter((a) => orgHit || hit(g.name) || hit(a.application)),
      }))
      .filter((x) => x.groupHit || x.apps.length > 0);
    const ungrouped = n.ungrouped.filter((a) => orgHit || hit(a.application));
    if (!orgHit && groups.length === 0 && ungrouped.length === 0) continue;
    const appCount = n.groups.reduce((c, g) => c + g.apps.length, 0) + n.ungrouped.length;
    // Without a search only the organisation in scope (or one the person opened) lists what is under it: an
    // organisation with sixty applications must not push every other organisation off the list.
    const open = q !== "" || expanded.has(n.org);
    rows.push({
      kind: "org",
      key: `org:${n.org}`,
      scope: { org: n.org },
      label: n.org,
      match: q !== "" && orgHit,
      apps: appCount,
      expanded: open,
    });
    if (!open) continue;
    for (const { g, apps } of groups) {
      rows.push({
        kind: "group",
        key: `group:${n.org}:${g.id}`,
        scope: { org: n.org, group: g.id },
        label: g.name,
        match: q !== "" && hit(g.name),
      });
      for (const a of apps) {
        rows.push({
          kind: "app",
          key: `app:${n.org}:${g.id}:${a.application}`,
          scope: { org: n.org, group: g.id, app: a.application },
          label: a.application,
          match: q !== "" && hit(a.application),
        });
      }
    }
    for (const a of ungrouped) {
      rows.push({
        kind: "app",
        key: `app:${n.org}::${a.application}`,
        scope: { org: n.org, app: a.application },
        label: a.application,
        match: q !== "" && hit(a.application),
      });
    }
  }
  return rows;
}

/** Fill in the group an application belongs to when the URL named only the application. Display only. */
export function resolveGroup(scope: Scope, tree: ScopeNode[]): { id: string; name: string } | undefined {
  if (!scope.org || (!scope.group && !scope.app)) return undefined;
  const node = tree.find((n) => n.org === scope.org);
  if (!node) return undefined;
  if (scope.group) return node.groups.find((g) => g.id === scope.group);
  return node.groups.find((g) => g.apps.some((a) => a.application === scope.app));
}

/** Does `scope` name something the caller can see? `undefined` while the tree is unknown. */
export function scopeExists(scope: Scope, tree: ScopeNode[] | undefined): boolean | undefined {
  if (!tree) return undefined;
  const s = normaliseScope(scope);
  if (!s.org) return true;
  const node = tree.find((n) => n.org === s.org);
  if (!node) return false;
  if (s.app && ![...node.ungrouped, ...node.groups.flatMap((g) => g.apps)].some((a) => a.application === s.app)) {
    return false;
  }
  // A group is checked only when the groups read succeeded; an unreadable groups list proves nothing.
  if (s.group && node.groups.length > 0 && !node.groups.some((g) => g.id === s.group)) return false;
  return true;
}

export function describeScope(scope: Scope, groupName?: string): string {
  const s = normaliseScope(scope);
  if (s.app) return `application ${s.app} in ${s.org}`;
  // A group id is an internal identifier, never a label. Someone who cannot list the organisation's groups has no
  // name for it, and gets a neutral phrase rather than the id.
  if (s.group) return groupName?.trim() ? `group ${groupName} in ${s.org}` : `a group in ${s.org}`;
  if (s.org) return `organisation ${s.org}`;
  return "all organisations";
}

// ---------------------------------------------------------------------------
// The last scope used
// ---------------------------------------------------------------------------

export const LAST_SCOPE_KEY = "airborne:cc-scope";

export function serialiseScope(s: Scope): string {
  return JSON.stringify(normaliseScope(s));
}

/** Whatever was stored, as a scope; anything that is not one reads as All. Never throws. */
export function parseStoredScope(text: string | null | undefined): Scope {
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const str = (x: unknown) => (typeof x === "string" && x.length <= 200 ? x : undefined);
    return normaliseScope({ org: str(v.org), group: str(v.group), app: str(v.app) });
  } catch {
    return {};
  }
}

/**
 * Where to open when the URL names no scope: the last scope used, if the organisation (and application) are still
 * there. `undefined` means stay at All. A group is not checked here (its list loads later); the page says so if it
 * has gone.
 */
export function restorableScope(
  stored: Scope,
  organisations: { name: string; applications: { application: string }[] }[]
): Scope | undefined {
  const s = normaliseScope(stored);
  if (!s.org) return undefined;
  const o = organisations.find((x) => x.name === s.org);
  if (!o) return undefined;
  if (s.app && !o.applications.some((a) => a.application === s.app)) return { org: s.org };
  return s;
}

/** Is this application one the caller has, in this organisation? `undefined` while the lists are unknown. */
export function appKnown(
  organisations: { name: string; applications: { application: string }[] }[] | undefined,
  org: string | undefined,
  app: string | undefined
): boolean | undefined {
  if (!organisations || organisations.length === 0) return undefined;
  if (!org || !app) return false;
  return organisations.find((o) => o.name === org)?.applications.some((a) => a.application === app) ?? false;
}

// ---------------------------------------------------------------------------
// "Which app?"
// ---------------------------------------------------------------------------

export interface AppChoice {
  org: string;
  app: string;
  /** Group name, when the groups were readable and the application is in one. */
  group?: string;
}

/**
 * The applications Create can ask about: those inside the scope, matching what was typed. A group scope narrows to
 * that group only when the groups were readable; an unreadable list narrows to the organisation rather than hiding
 * applications.
 */
export function appChoices(tree: ScopeNode[], scope: Scope, query = ""): AppChoice[] {
  const s = normaliseScope(scope);
  const q = query.trim().toLowerCase();
  const out: AppChoice[] = [];
  for (const n of tree) {
    if (s.org && n.org !== s.org) continue;
    const narrowed = s.group && n.groups.some((g) => g.id === s.group);
    for (const g of n.groups) {
      if (narrowed && g.id !== s.group) continue;
      for (const a of g.apps) out.push({ org: n.org, app: a.application, group: g.name });
    }
    if (!narrowed) for (const a of n.ungrouped) out.push({ org: n.org, app: a.application });
  }
  return out
    .filter((c) => q === "" || c.app.toLowerCase().includes(q) || c.org.toLowerCase().includes(q))
    .sort((a, b) => a.org.localeCompare(b.org) || a.app.localeCompare(b.app));
}
