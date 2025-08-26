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
  role: string[];
}

export interface Organisation {
  name: string;
  applications: Application[];
  access?: string[];
  users?: OrganisationUser[];

}

export interface Application {
  id: string;
  application: string;
  organisation?: string;
  access?: string[];
  versions: string[];
}

export type HomeResponse =
  | { type: "CREATE_ORGANISATION"; name: string }
  | { type: "CREATE_APPLICATION"; organisation: string; name: string }
  | { type: "INVITE_USER"; organisation: string; email: string; role: string };

export type Configuration = {
  enableGoogleSignIn: boolean;
  organisationCreationDisabled: boolean;
}

export type View = {
  id: string;
  name: string;
  dimensions: {
   key:string;
   value:string;
  }[]
  created_at: Date;
};

