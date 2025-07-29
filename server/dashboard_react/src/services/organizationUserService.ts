import axios from "../api/axios";

export interface OrganizationUserRequest {
  user: string;
  access: string;
}

export interface OrganizationUserResponse {
  users: Array<{
    username: string;
    email: string;
    roles: string[];
  }>;
}

export const organizationUserService = {
  async listUsers(orgName: string): Promise<OrganizationUserResponse> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    try {
      const response = await axios.get(`/organisation/user/list`, { headers });
      return response.data;
    } catch (err: any) {
      if (err.status == 401) {
        document.location = "/dashboard/";
      }
      throw err;
    }
  },

  async addUser(orgName: string, request: OrganizationUserRequest): Promise<void> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    await axios.post(`/organisation/user/create`, request, { headers });
  },

  async updateUser(orgName: string, request: OrganizationUserRequest): Promise<void> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    await axios.post(`/organisation/user/update`, request, { headers });
  },

  async removeUser(orgName: string, username: string): Promise<void> {
    const headers: Record<string, string> = {};
    headers["x-organisation"] = orgName;
    await axios.post(`/organisation/user/remove`, { user: username }, { headers });
  },
};
