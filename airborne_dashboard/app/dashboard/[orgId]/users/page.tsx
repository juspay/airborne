"use client";
import useSWR, { mutate } from "swr";
import React from "react";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { Button } from "@/components/ui/button";

type OrgUsers = { users: { user: string; access: string }[] };

export default function OrganisationUsersPage() {
  const { token, org } = useAppContext();
  const { data, isLoading, error } = useSWR<OrgUsers>(token && org ? "/organisation/user" : null, (url: string) =>
    apiFetch<any>(url, {}, { token, org })
  );

  const [user, setUser] = React.useState("");
  const [access, setAccess] = React.useState<"owner" | "admin" | "write" | "read">("read");

  const addUser = async () => {
    await apiFetch("/organisation/user/create", { method: "POST", body: { user, access } }, { token, org });
    setUser("");
    mutate("/organisation/user");
  };

  const updateUser = async (u: string, a: string) => {
    await apiFetch("/organisation/user/update", { method: "POST", body: { user: u, access: a } }, { token, org });
    mutate("/organisation/user");
  };

  const removeUser = async (u: string) => {
    await apiFetch("/organisation/user/remove", { method: "POST", body: { user: u } }, { token, org });
    mutate("/organisation/user");
  };

  return (
    <>
      {!org ? (
        <div className="p-6">Select an organisation first</div>
      ) : isLoading ? (
        <div className="p-6">Loading...</div>
      ) : error ? (
        <div className="p-6">Error</div>
      ) : (
        <div className="p-6 space-y-6">
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2"
              placeholder="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
            <select
              className="border rounded px-3 py-2"
              value={access}
              onChange={(e) => setAccess(e.target.value as any)}
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="write">write</option>
              <option value="read">read</option>
            </select>
            <Button className="bg-purple-600 text-white rounded px-3 py-2" onClick={addUser}>
              Add
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">User</th>
                <th className="py-2">Access</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.map((u) => (
                <tr key={u.user} className="border-b">
                  <td className="py-2">{u.user}</td>
                  <td className="py-2">{u.access}</td>
                  <td className="py-2 flex gap-2">
                    {["owner", "admin", "write", "read"].map((opt) => (
                      <button key={opt} className="border rounded px-2 py-1" onClick={() => updateUser(u.user, opt)}>
                        {opt}
                      </button>
                    ))}
                    <button className="text-red-600" onClick={() => removeUser(u.user)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
