import { redirect } from "next/navigation";

/** Settings has no landing page of its own — send it to the first tab. */
export default async function SettingsPage({ params }: { params: Promise<{ orgId: string; appId: string }> }) {
  const { orgId, appId } = await params;

  redirect(`/dashboard/${encodeURIComponent(orgId)}/${encodeURIComponent(appId)}/settings/integrity`);
}
