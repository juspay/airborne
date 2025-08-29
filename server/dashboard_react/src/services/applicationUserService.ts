import axios from "../api/axios";

export interface ApplicationUserRequest {
  user: string;
  access: string;
}

export interface ApplicationUserResponse {
  users: Array<{
    id: string;
    username: string;
    email: string;
    roles: string[];
  }>;
}

export const applicationUserService = {
  async listUsers(orgName: string, appName: string): Promise<ApplicationUserResponse> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    headers["x-application"] = appName;
    try{
        const response = await axios.get(`/organisations/applications/user/list`, { headers });
        return response.data;
    }catch(err: any){
        if(err.status == 401){
            document.location = "/dashboard/"
        }
        return null;
    }
  },

  async addUser(orgName: string, appName: string, request: ApplicationUserRequest): Promise<void> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    headers["x-application"] = appName;
    await axios.post(`/organisations/applications/user/create`, request, { headers });
  },

  async updateUser(orgName: string, appName: string, request: ApplicationUserRequest): Promise<void> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    headers["x-application"] = appName;
    await axios.post(`/organisations/applications/user/update`, request, { headers });
  },

  async removeUser(orgName: string, appName: string, username: string): Promise<void> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    headers["x-application"] = appName;
    await axios.post(`/organisations/applications/user/remove`, { user: username }, { headers });
  },
};
