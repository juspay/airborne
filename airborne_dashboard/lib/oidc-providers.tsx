import type { ComponentType } from "react";
import { Github, Globe, Shield } from "lucide-react";

export type OidcProviderUi = {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

export const GENERIC_OIDC_PROVIDER: OidcProviderUi = {
  id: "",
  label: "Single Sign-On",
  Icon: Shield,
};

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const KNOWN_OIDC_PROVIDERS: Record<string, OidcProviderUi> = {
  google: { id: "google", label: "Google", Icon: GoogleIcon },
  github: { id: "github", label: "GitHub", Icon: Github },
  auth0: { id: "auth0", label: "Auth0", Icon: Shield },
  okta: { id: "okta", label: "Okta", Icon: Shield },
};

function humanizeProviderId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveOidcProviders(enabledIdps?: string[]): OidcProviderUi[] {
  if (!enabledIdps || enabledIdps.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  return enabledIdps
    .map((rawId) => rawId.trim().toLowerCase())
    .filter((id) => id.length > 0)
    .filter((id) => {
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    })
    .map((id) => {
      const known = KNOWN_OIDC_PROVIDERS[id];
      if (known) {
        return known;
      }

      return {
        id,
        label: humanizeProviderId(id),
        Icon: Globe,
      };
    });
}
