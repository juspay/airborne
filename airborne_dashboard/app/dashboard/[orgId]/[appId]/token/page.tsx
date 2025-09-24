"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Copy, Download, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { notFound } from "next/navigation";
import { hasAppAccess } from "@/lib/utils";

interface PAT {
  client_id: string;
  created_at: string;
}

interface NewToken {
  client_id: string;
  client_secret: string;
}

interface ListRespone {
  data: PAT[];
}

const TokensPage = () => {
  const { token, org, app, loadingAccess, getAppAccess, getOrgAccess, user } = useAppContext();

  const [tokens, setTokens] = useState<PAT[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newToken, setNewToken] = useState<NewToken | null>(null);
  const [creatingToken, setCreatingToken] = useState(false);
  const [deletingToken, setDeletingToken] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app), "admin")) {
      notFound();
    }
  }, [loadingAccess]);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const { data } = await apiFetch<ListRespone>("/token/list", {}, { token, org, app });
      setTokens(data);
    } catch (error) {
      console.error("Error loading tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = () => {
    setPassword("");
    setShowPassword(false);
    setShowPasswordDialog(true);
  };

  const confirmCreateToken = async () => {
    if (!password.trim()) {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingToken(true);
      const response = await apiFetch<NewToken>(
        "/token",
        {
          method: "POST",
          body: { password, name: user?.name },
        },
        {
          token,
          org,
          app,
        }
      );

      setNewToken(response);
      setShowPasswordDialog(false);
      setShowTokenDialog(true);
      setPassword("");
      loadTokens();
    } catch (error) {
      console.error("Error creating token:", error);
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = (tokenId: string) => {
    setTokenToDelete(tokenId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteToken = async () => {
    if (!tokenToDelete) return;

    try {
      setDeletingToken(true);
      await apiFetch<{ success: boolean }>(
        `/token/${tokenToDelete}`,
        {
          method: "DELETE",
        },
        {
          token,
          org,
          app,
        }
      );

      setTokens(tokens.filter((token) => token.client_id !== tokenToDelete));
      toast({
        title: "Success",
        description: "Token deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting token:", error);
      toast({
        title: "Error",
        description: "Failed to delete token",
        variant: "destructive",
      });
    } finally {
      setDeletingToken(false);
      setShowDeleteDialog(false);
      setTokenToDelete(null);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const downloadAsJson = () => {
    if (!newToken) return;

    const data = {
      client_id: newToken.client_id,
      client_secret: newToken.client_secret,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pat-${newToken.client_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Token saved as JSON file",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Personal Access Tokens</h1>
          <p className="text-muted-foreground mt-2">Manage your personal access tokens for API authentication</p>
        </div>
        <Button onClick={handleCreateToken} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Token
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : tokens.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <p className="text-lg mb-2">No tokens found</p>
              <p>Create your first personal access token to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tokens.map((token) => (
            <Card key={token.client_id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {token.client_id}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Created: {formatDate(token.created_at)}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteToken(token.client_id)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Password Confirmation Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Password</DialogTitle>
            <DialogDescription>
              Please enter your account password to create a new personal access token.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={(e) => e.key === "Enter" && confirmCreateToken()}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)} disabled={creatingToken}>
              Cancel
            </Button>
            <Button onClick={confirmCreateToken} disabled={creatingToken}>
              {creatingToken ? "Creating..." : "Create Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Display Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Token Created Successfully</DialogTitle>
            <DialogDescription>
              Your personal access token has been created. Make sure to copy it now as you won&apos;t be able to see it
              again.
            </DialogDescription>
          </DialogHeader>
          {newToken && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <div className="flex items-center gap-2">
                  <Input value={newToken.client_id} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(newToken.client_id, "Client ID")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="flex items-center gap-2">
                  <Input value={newToken.client_secret} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newToken.client_secret, "Client Secret")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Important:</strong> This is the only time you`&apos;ll see the client secret. Make sure to
                  copy it and store it securely.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={downloadAsJson} className="flex items-center gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Download JSON
            </Button>
            <Button onClick={() => setShowTokenDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Token</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this personal access token? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {tokenToDelete && (
            <div className="py-4">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Token ID:</strong> <span className="font-mono">{tokenToDelete}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deletingToken}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteToken} disabled={deletingToken}>
              {deletingToken ? "Deleting..." : "Delete Token"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TokensPage;
