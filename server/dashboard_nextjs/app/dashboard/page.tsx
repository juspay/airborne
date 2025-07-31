"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import SharedLayout from "@/components/shared-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Organisation = {
  name: string;
  applications: { application: string }[];
};

export default function DashboardHome() {
  const router = useRouter();
  const { org, app, setOrg, setApp, token, logout } = useAppContext();

  const { data: orgs, mutate: refreshOrgs } = useSWR(token ? "/organisations" : null, (url) =>
    apiFetch<Organisation[]>(url, {}, { token, logout })
  );
  const orgList: Organisation[] = orgs || [];
  const apps = useMemo(
    () => orgList.find((o) => o.name === org)?.applications?.map((a) => a.application) || [],
    [orgList, org]
  );

  const [orgName, setOrgName] = useState("");
  const [appName, setAppName] = useState("");

  useEffect(() => {
    if (orgList.length === 0) {
      // No orgs → prompt to create
      return;
    }

    if (org && apps.length === 0) {
      // If org selected but no apps in that org → prompt to create app
      router.replace("/dashboard/" + org);
      return;
    }

    // When both selected, go to Files by default
    if (org && app) {
      router.replace("/dashboard/" + org + "/" + app);
    }
  }, [orgList, org, apps, app, router]);

  const onCreateOrg = async () => {
    await apiFetch("/organisations/create", { method: "POST", body: { name: orgName } }, { token, logout });
    const createdOrg = orgName;
    setOrgName("");
    await refreshOrgs();
    setOrg(createdOrg);
  };

  const onCreateApp = async () => {
    await apiFetch(
      "/organisations/applications/create",
      { method: "POST", body: { application: appName } },
      { token, org, logout }
    );
    setAppName("");
    await refreshOrgs();
  };

  // No orgs → prompt to create
  if (orgList.length === 0) {
    return (
      <SharedLayout>
        <div className="mx-auto max-w-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Create your first Organisation</h2>
          <p className="text-muted-foreground mb-4">You need an organisation to get started.</p>
          <Label htmlFor="orgname">Organisation name</Label>
          <Input id="orgname" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="mb-3" />
          <Button onClick={onCreateOrg} disabled={!orgName.trim()}>
            Create Organisation
          </Button>
        </div>
      </SharedLayout>
    );
  }

  // If org selected but no apps in that org → prompt to create app
  if (org && apps.length === 0) {
    return (
      <SharedLayout>
        <div className="mx-auto max-w-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Create your first Application</h2>
          <p className="text-muted-foreground mb-4">Applications group files, packages, and releases.</p>
          <Label htmlFor="appname">Application name</Label>
          <Input id="appname" value={appName} onChange={(e) => setAppName(e.target.value)} className="mb-3" />
          <Button onClick={onCreateApp} disabled={!appName.trim()}>
            Create Application
          </Button>
        </div>
      </SharedLayout>
    );
  }

  // Selection screen: pick org/app
  if (!org || !app) {
    return (
      <SharedLayout>
        <div className="mx-auto max-w-2xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Select Organisation</h2>
            <Select onValueChange={(v) => setOrg(v)} value={org || ""}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgList.map((o) => (
                  <SelectItem key={o.name} value={o.name}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {org ? (
            <div>
              <h2 className="text-xl font-semibold mb-2">Select Application</h2>
              <Select onValueChange={(v) => setApp(v)} value={app || ""}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose application" />
                </SelectTrigger>
                <SelectContent>
                  {apps.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={() => router.push("/dashboard/files")} disabled={!org || !app}>
              Continue
            </Button>
          </div>
        </div>
      </SharedLayout>
    );
  }

  return null;
}
