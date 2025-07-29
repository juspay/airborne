export interface User {
  id: string;
  name: string;
  email: string;
  organisations: Organisation[];
}

export interface OrganisationUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface ApplicationUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

export interface Organisation {
  id: string;
  name: string;
  access: string[];
  applications: Application[];
  users?: OrganisationUser[];
}

export interface Application {
  id: string;
  application: string;
  versions: string[];
  access: string[];
  users?: ApplicationUser[];
}

export type HomeResponse =
  | { type: "CREATE_ORGANISATION"; name: string }
  | { type: "CREATE_APPLICATION"; organisation: string; name: string }
  | { type: "INVITE_USER"; organisation: string; email: string; role: string }
  | { type: "REQUEST_ORGANISATION"; orgName: string; name: string; email: string; phoneNumber?: string; appStoreLink?: string; playStoreLink?: string; errorCb?: (message: string) => void; successCb?: () => void }
  | { type: "REMOVE_USER"; organisation: string; user: string }

export type Configuration = {
  enableGoogleSignIn: boolean;
  organisationCreationDisabled: boolean;
}


export interface ReleaseInfo {
  config: {
    version: string;
    release_config_timeout: number;
    package_timeout: number;
    properties: {
      tenant_info: {
        assets_domain: string;
        default_client_id: string;
      };
    };
  };
  package: {
    name: string;
    version: string;
    properties: {
      manifest: Record<string, any>;
      manifest_hash: Record<string, any>;
    };
    index: string;
    important: Array<{
      url: string;
      file_path: string;
    }>;
    lazy: Array<{
      url: string;
      file_path: string;
    }>;
  };
}