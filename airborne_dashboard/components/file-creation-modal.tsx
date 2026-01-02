"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";

interface FileCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function FileCreationModal({ open, onOpenChange, onCreated }: FileCreationModalProps) {
  const { token, org, app } = useAppContext();
  const [filePath, setFilePath] = useState("");
  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("");
  const [checksum, setChecksum] = useState("");
  const [size, setSize] = useState("");
  const [metadata, setMetadata] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    let meta: any | undefined = undefined;
    if (metadata.trim()) {
      try {
        meta = JSON.parse(metadata);
      } catch (e) {
        console.log("Error", e);
        setError("Metadata must be valid JSON");
        setIsSubmitting(false);
        return;
      }
    }

    // Validate checksum and size are provided together
    if ((checksum.trim() && !size.trim()) || (!checksum.trim() && size.trim())) {
      setError("Both checksum and size must be provided together, or neither");
      setIsSubmitting(false);
      return;
    }

    // Validate checksum format (SHA256 hex should be 64 characters)
    if (checksum.trim()) {
      const checksumValue = checksum.trim();
      const hexRegex = /^[a-fA-F0-9]{64}$/;
      if (!hexRegex.test(checksumValue)) {
        setError("Checksum must be a valid SHA256 hash (64 hexadecimal characters)");
        setIsSubmitting(false);
        return;
      }
    }

    // Validate size is a valid positive number
    if (size.trim()) {
      const sizeNum = Number(size);
      if (isNaN(sizeNum) || sizeNum <= 0) {
        setError("Size must be a valid positive number (in bytes)");
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await apiFetch(
        "/file",
        {
          method: "POST",
          body: {
            file_path: filePath,
            url,
            ...(tag ? { tag } : {}),
            ...(meta ? { metadata: meta } : {}),
            ...(checksum.trim() && size.trim() ? { checksum: checksum.trim(), size: Number(size) } : {}),
          },
        },
        { token, org, app }
      );
      onOpenChange(false);
      setFilePath("");
      setUrl("");
      setTag("");
      setChecksum("");
      setSize("");
      setMetadata("");
      onCreated?.();
    } catch (e: any) {
      setError(e.message || "Failed to create file");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = filePath.trim() && url.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-space-grotesk)]">Create File</DialogTitle>
          <DialogDescription>Provide a URL and metadata to register a file in your application</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file_path">File Path *</Label>
            <Input
              id="file_path"
              placeholder="e.g., dist/app-bundle.js"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <Input
              id="url"
              placeholder="https://cdn.example.com/dist/app-bundle.js"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag">Tag</Label>
            <Input id="tag" placeholder="latest" value={tag} onChange={(e) => setTag(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="checksum">Checksum (SHA256 hex, optional)</Label>
            <Input
              id="checksum"
              placeholder="e.g., a3f2b1c4d5e6f7890abcdef1234567890abcdef1234567890abcdef123456789"
              value={checksum}
              onChange={(e) => setChecksum(e.target.value.trim().toLowerCase())}
              maxLength={64}
              pattern="[a-fA-F0-9]{64}"
            />
            <p className="text-xs text-muted-foreground">
              Required only for authenticated/private files. Must be 64 hex characters. Must be provided with size.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Size (bytes, optional)</Label>
            <Input id="size" placeholder="e.g., 1048576" value={size} onChange={(e) => setSize(e.target.value)} />
            <p className="text-xs text-muted-foreground">File size in bytes. Must be provided with checksum.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="metadata">Metadata (JSON, optional)</Label>
            <Textarea
              id="metadata"
              placeholder='{"commit":"abc123"}'
              rows={3}
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Creating..." : "Create File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
