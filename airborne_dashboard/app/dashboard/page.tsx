"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface OrganisationsList {
  organisations: { name: string; applications: { application: string; organisation: string }[] }[];
}

export default function DashboardHome() {
  const router = useRouter();
  const { org, app, setOrg, setApp, token, logout, config } = useAppContext();
  const [reqOrgName, setReqOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [appStoreLink, setAppStoreLink] = useState("");
  const [playStoreLink, setPlayStoreLink] = useState("");
  const [orgRequestSuccess, setOrgRequestSuccess] = useState(false);
  const { data: orgs, mutate: refreshOrgs } = useSWR(token ? "/organisations" : null, (url) =>
    apiFetch<OrganisationsList>(url, {}, { token, logout })
  );

  const resetOrgRequestForm = () => {
    setReqOrgName("");
    setName("");
    setEmail("");
    setAppStoreLink("");
    setPlayStoreLink("");
    setOrgRequestSuccess(false);
  };
  const orgList: { name: string; applications: { application: string }[] }[] = orgs?.organisations || [];
  const apps = useMemo(
    () => orgList.find((o) => o.name === org)?.applications?.map((a) => a.application) || [],
    [orgList, org]
  );

  const [orgName, setOrgName] = useState("");
  const [appName, setAppName] = useState("");

  // Check for saved org request data on component mount
  useEffect(() => {
    const savedRequest = localStorage.getItem("org_request_data");
    if (savedRequest && config?.organisation_creation_disabled) {
      try {
        const requestData = JSON.parse(savedRequest);
        setReqOrgName(requestData.organisation_name || "");
        setName(requestData.name || "");
        setEmail(requestData.email || "");
        setAppStoreLink(requestData.app_store_link || "");
        setPlayStoreLink(requestData.play_store_link || "");
        setOrgRequestSuccess(true);
      } catch (err) {
        console.error("Error parsing saved org request:", err);
      }
    }
  }, [config?.organisation_creation_disabled]);

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
    } catch (err) {
      console.error("Error while requesting organisation:", err);
    }
  };

  // No orgs → prompt to create
  if (orgList.length === 0) {
    return (
      <div className="mt-10">
        {config?.organisation_creation_disabled ? (
          orgRequestSuccess ? (
            <Card className="mx-auto max-w-lg shadow-lg border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold text-green-800">Request Submitted Successfully!</CardTitle>
                <CardDescription className="text-green-700">
                  Your organisation request has been submitted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-green-800">
                  <p className="font-medium">Organisation: {reqOrgName}</p>
                  <p>Someone from our team will connect with you soon to process your request.</p>
                  <p className="text-sm text-green-600">We&apos;ll reach out to you at {email}.</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full border-green-300 text-green-800 hover:bg-green-100"
                  onClick={resetOrgRequestForm}
                >
                  Submit Another Request
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="mx-auto max-w-lg shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">Request your first Organisation</CardTitle>
                <CardDescription>
                  You need an organisation to get started. Fill in the details below to request one.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organisation name</Label>
                    <Input id="orgName" value={reqOrgName} onChange={(e) => setReqOrgName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Your name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appStoreLink">App Store Link</Label>
                    <Input id="appStoreLink" value={appStoreLink} onChange={(e) => setAppStoreLink(e.target.value)} />
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
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={onRequestOrg}
                  disabled={!reqOrgName.trim() || !name.trim() || !email.trim()}
                >
                  Request Organisation
                </Button>
              </CardFooter>
            </Card>
          )
        ) : (
          <Card className="mx-auto max-w-lg shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Create your first Organisation</CardTitle>
              <CardDescription>You need an organisation to get started. Enter a name below.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orgname">Organisation name</Label>
                  <Input id="orgname" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={onCreateOrg} disabled={!orgName.trim()}>
                Create Organisation
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    );
  }

  // If org selected but no apps in that org → prompt to create app
  if (org && apps.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Create your first Application</h2>
        <p className="text-muted-foreground mb-4">Applications group files, packages, and releases.</p>
        <Label htmlFor="appname">Application name</Label>
        <Input id="appname" value={appName} onChange={(e) => setAppName(e.target.value)} className="mb-3" />
        <Button onClick={onCreateApp} disabled={!appName.trim()}>
          Create Application
        </Button>
      </div>
    );
  }

  // Selection screen: pick org/app
  if (!org || !app) {
    return (
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
    );
  }

  return null;
}
