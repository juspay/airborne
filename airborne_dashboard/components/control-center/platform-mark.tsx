import type { ComponentType } from "react";
import { Apple, Box, Globe, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformLabel } from "@/lib/control-center/format";
import type { Platform } from "@/lib/control-center/types";

const ICONS: Record<Platform, ComponentType<{ className?: string }>> = {
  android: Smartphone,
  ios: Apple,
  web: Globe,
  other: Box,
};

export function PlatformIcon({ platform, className }: { platform: Platform | null; className?: string }) {
  const Icon = platform ? ICONS[platform] : Box;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden />;
}

export function PlatformMark({
  platform,
  className,
  size = "sm",
}: {
  platform: Platform | null;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-medium text-foreground",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      <PlatformIcon platform={platform} className={cn("text-muted-foreground", size === "md" && "h-4 w-4")} />
      {platformLabel(platform)}
    </span>
  );
}
